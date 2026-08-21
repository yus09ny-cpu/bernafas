import { supabaseAdmin } from './supabaseAdmin.js'
import { recordCommissionsForPaidOrder } from './commissions.js'
import { autoCreateAffiliateForOrder } from './affiliateAutoSignup.js'

// Single choke point for "an order just became paid" — extracted
// (2026-08-21) from api/checkout/callback.ts, which was the ONLY caller
// until api/checkout/manual-payment.ts's admin-approve action needed the
// exact same sequence for the Wise (Antarabangsa) manual-payment path.
// Never re-implement this at a new call site — always call this function,
// so every "paid" order gets the identical downstream treatment
// (commissions, subscription extension, auto-affiliate) regardless of
// which payment method produced it. Behavior is byte-identical to what
// callback.ts did inline before this extraction — verified via the same
// test suite that already covered callback.ts's paid path.
const SUBSCRIPTION_PERIOD_DAYS = 30

async function extendAppSubscription(orderId: string, userId: string | null): Promise<void> {
  if (!userId) {
    // Shouldn't happen — create-bill.ts requires a verified user to create
    // an app_subscription order in the first place — but a paid order with
    // no user_id to credit is a data problem worth knowing about rather
    // than silently doing nothing.
    console.error(`[markOrderPaid] app_subscription order ${orderId} has no user_id — cannot extend.`)
    return
  }

  const newExpiry = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ subscription_tier: 'active', subscription_expiry: newExpiry })
    .eq('id', userId)

  if (error) {
    console.error(`[markOrderPaid] failed to extend subscription for user ${userId}:`, error.message)
  }
}

interface PaidOrder {
  id: string
  affiliate_ref: string | null
  amount: number | null
  created_at: string
  product_type: string
  user_id: string | null
  email: string | null
}

export interface MarkOrderPaidResult {
  success: boolean
  order?: PaidOrder
  error?: string
}

export async function markOrderPaid(orderId: string): Promise<MarkOrderPaidResult> {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('id, affiliate_ref, amount, created_at, product_type, user_id, email')
    .single()

  if (error) {
    console.error('[markOrderPaid] order update (paid) failed:', error.message)
    return { success: false, error: error.message }
  }

  await recordCommissionsForPaidOrder(order)
  if (order.product_type === 'app_subscription') {
    await extendAppSubscription(order.id, order.user_id)
  }
  // Auto-affiliate-on-purchase — must NEVER prevent the caller from
  // treating this order as successfully paid (already committed above).
  try {
    await autoCreateAffiliateForOrder(order.id, order.email)
  } catch (err) {
    console.error(`[markOrderPaid] auto-affiliate signup threw unexpectedly for order ${order.id}:`, err)
  }

  return { success: true, order }
}
