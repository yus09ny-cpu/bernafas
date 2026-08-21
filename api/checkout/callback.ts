import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { recordCommissionsForPaidOrder } from '../_lib/commissions.js'
import { autoCreateAffiliateForOrder } from '../_lib/affiliateAutoSignup.js'

// ToyyibPay's server-to-server callback (billCallbackUrl in create-bill.ts)
// — POSTs application/x-www-form-urlencoded, not JSON. status_id: 1 = paid,
// 2 = pending, 3 = failed (ToyyibPay's own convention). On a paid order,
// flips orders.status AND triggers commission calculation
// (recordCommissionsForPaidOrder, commissions.ts) — the rate decision has
// landed, so this no longer just leaves affiliate_ref sitting unprocessed.
//
// product_type === 'app_subscription' ALSO extends the buying profile's
// subscription — see extendAppSubscription() below. App.tsx's gate
// (useAppAccess -> api/app-access/status.ts, wired 2026-08-20) reads
// exactly what this writes. Note this file does NOT write anything for
// paid 'pakej_lifetime' orders — that product's "Akses aplikasi selamanya"
// is checked live (a direct paid-order lookup) by app-access/status.ts
// instead of being mirrored into profiles here; see that file's own
// comment for why.
//
// ANY paid order (all 4 product types) also auto-creates an affiliate row
// for the buyer's e-mail if one doesn't already exist (2026-08-21, spec
// item 2 — see api/_lib/affiliateAutoSignup.ts). This is the one place in
// this file where a failure must NEVER be allowed to affect the order-paid
// outcome above (already committed) or this handler's response — see that
// call site's own comment for the layered try/catch reasoning.
const SUBSCRIPTION_PERIOD_DAYS = 30

async function extendAppSubscription(orderId: string, userId: string | null): Promise<void> {
  if (!userId) {
    // Shouldn't happen — create-bill.ts requires a verified user to create
    // an app_subscription order in the first place — but a paid order with
    // no user_id to credit is a data problem worth knowing about rather
    // than silently doing nothing.
    console.error(`[api/checkout/callback] app_subscription order ${orderId} has no user_id — cannot extend.`)
    return
  }

  const newExpiry = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ subscription_tier: 'active', subscription_expiry: newExpiry })
    .eq('id', userId)

  if (error) {
    console.error(`[api/checkout/callback] failed to extend subscription for user ${userId}:`, error.message)
  }
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const body = (req.body ?? {}) as Record<string, string>
  const orderId = body.order_id ?? body.billExternalReferenceNo
  const statusId = body.status_id

  if (!orderId) {
    res.status(400).send('Missing order reference')
    return
  }

  if (statusId === '1') {
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', orderId)
      .select('id, affiliate_ref, amount, created_at, product_type, user_id, email')
      .single()

    if (error) {
      console.error('[api/checkout/callback] order update (paid) failed:', error.message)
    } else {
      await recordCommissionsForPaidOrder(order)
      if (order.product_type === 'app_subscription') {
        await extendAppSubscription(order.id, order.user_id)
      }
      // Auto-affiliate-on-purchase (2026-08-21, spec item 2) — ANY paid
      // order makes the buyer an affiliate, no registration step. Wrapped
      // here on top of affiliateAutoSignup.ts's own internal try/catch
      // (belt-and-suspenders, see that file's header) — this call must
      // NEVER prevent res.status(200) below from being reached. The order
      // itself is ALREADY committed 'paid' by the update above regardless
      // of anything that happens from here on.
      try {
        await autoCreateAffiliateForOrder(order.id, order.email)
      } catch (err) {
        console.error(`[api/checkout/callback] auto-affiliate signup threw unexpectedly for order ${order.id}:`, err)
      }
    }
  } else if (statusId === '3') {
    const { error } = await supabaseAdmin.from('orders').update({ status: 'failed' }).eq('id', orderId)
    if (error) console.error('[api/checkout/callback] order update (failed) failed:', error.message)
  }
  // statusId === '2' (pending) — no-op, order already defaults to 'pending'.

  // ToyyibPay expects a 200 regardless of internal outcome, or it retries
  // the callback — always acknowledge receipt.
  res.status(200).send('OK')
}
