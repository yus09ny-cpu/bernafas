import { supabaseAdmin } from './supabaseAdmin.js'

// Rate decision (2026-08-19) — fixed constants, NOT read from
// affiliate_commission_rates (that table stays empty/unused; its
// per-product_type shape doesn't match a decision that doesn't vary by
// product_type at all — see 0004_affiliate_commissions.sql's header).
const BASE_RATE = 0.15
const BONUS_RATE = 0.2
// Sale #1-20 in a calendar month: BASE_RATE. Sale #21 onward (same
// affiliate, same month): BONUS_RATE. Resets every month — never
// retroactive (sales #1-20 already paid at BASE_RATE keep that rate
// forever, even once the affiliate crosses the threshold later the same
// month).
const BONUS_THRESHOLD_SEQUENCE = 21
const REFERRAL_OVERRIDE_RATE = 0.05

interface PaidOrder {
  id: string
  affiliate_ref: string | null
  amount: number | null
  created_at: string
}

// Called once, right after an order's status is set to 'paid' (currently
// only api/checkout/callback.ts). Idempotent — safe to call twice for the
// same order (ToyyibPay's own callback can retry if it doesn't get a fast
// 200; ours always returns 200 regardless, but this guards the case where
// it fires anyway before that response lands).
export async function recordCommissionsForPaidOrder(order: PaidOrder): Promise<void> {
  if (!order.affiliate_ref || !order.amount) return // no affiliate attribution, or nothing to take a percentage of

  const affiliateUsername = order.affiliate_ref

  // Idempotency guard — a 'sale' row already existing for this order_id
  // means this order was already processed (by an earlier call or a
  // retried webhook); skip entirely rather than risk a second 'sale' row
  // (and a second, wrongly-doubled referral_override alongside it).
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('affiliate_commissions')
    .select('id')
    .eq('order_id', order.id)
    .eq('commission_type', 'sale')
    .maybeSingle()

  if (existingError) {
    console.error('[commissions] idempotency check failed:', existingError.message)
    return
  }
  if (existing) return

  // Sequence number = how many 'paid' orders this affiliate has in the
  // SAME calendar month as this order's created_at (spec: "created_at
  // bulan ni", deliberately not paid_at) — including this order itself,
  // which is safe to rely on here because the caller updates orders.status
  // to 'paid' BEFORE calling this function, so this order is already
  // counted by the query below.
  //
  // NOTE — no transaction/lock around this count-then-insert: two
  // webhooks for the SAME affiliate landing at the exact same instant
  // could in principle read the same sequence number and both apply
  // BASE_RATE when one "should" have been the bonus-rate sale. Accepted
  // as a real, un-fixed race for this first build — ToyyibPay callbacks
  // for genuinely simultaneous sales of the same affiliate are rare
  // enough, and the cost of being wrong is a few RM of commission
  // misclassification, not a correctness-critical failure.
  const orderDate = new Date(order.created_at)
  const monthStart = new Date(Date.UTC(orderDate.getUTCFullYear(), orderDate.getUTCMonth(), 1)).toISOString()
  const monthEnd = new Date(Date.UTC(orderDate.getUTCFullYear(), orderDate.getUTCMonth() + 1, 1)).toISOString()

  const { count: sequence, error: countError } = await supabaseAdmin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('affiliate_ref', affiliateUsername)
    .eq('status', 'paid')
    .gte('created_at', monthStart)
    .lt('created_at', monthEnd)

  if (countError) {
    console.error('[commissions] sequence count failed:', countError.message)
    return
  }

  const rate = (sequence ?? 1) >= BONUS_THRESHOLD_SEQUENCE ? BONUS_RATE : BASE_RATE

  const { error: saleError } = await supabaseAdmin.from('affiliate_commissions').insert({
    affiliate_username: affiliateUsername,
    order_id: order.id,
    amount: order.amount * rate,
    commission_type: 'sale',
    rate_applied: rate,
    status: 'pending',
  })
  if (saleError) {
    console.error('[commissions] sale commission insert failed:', saleError.message)
    return
  }

  // 2-tier referral override — every paid sale from a referred affiliate
  // pays their upline REFERRAL_OVERRIDE_RATE, for as long as they keep
  // selling (not a one-time signup bonus). Looked up fresh per order
  // rather than cached, since referred_by_username could in principle
  // change (it doesn't today — nothing in this app updates it after
  // registration — but this function shouldn't assume that).
  const { data: affiliate, error: affiliateError } = await supabaseAdmin
    .from('affiliates')
    .select('referred_by_username')
    .eq('username', affiliateUsername)
    .maybeSingle()

  if (affiliateError) {
    console.error('[commissions] upline lookup failed:', affiliateError.message)
    return
  }
  if (!affiliate?.referred_by_username) return

  const { error: referralError } = await supabaseAdmin.from('affiliate_commissions').insert({
    affiliate_username: affiliate.referred_by_username,
    order_id: order.id,
    amount: order.amount * REFERRAL_OVERRIDE_RATE,
    commission_type: 'referral_override',
    rate_applied: REFERRAL_OVERRIDE_RATE,
    status: 'pending',
  })
  if (referralError) {
    console.error('[commissions] referral override insert failed:', referralError.message)
  }
}
