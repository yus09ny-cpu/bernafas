import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'

// ToyyibPay's server-to-server callback (billCallbackUrl in create-bill.ts)
// — POSTs application/x-www-form-urlencoded, not JSON. status_id: 1 = paid,
// 2 = pending, 3 = failed (ToyyibPay's own convention). Only flips
// orders.status to 'paid'; does NOT create any affiliate_commissions row —
// commission creation is explicitly deferred until the rate decision lands
// (spec's own instruction), so a paid order sits with affiliate_ref filled
// but no commission row yet. Whoever builds the commission-calculation pass
// later reads FROM orders (status='paid', affiliate_ref is not null), not
// from anything this callback writes beyond order status.
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
    const { error } = await supabaseAdmin
      .from('orders')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', orderId)
    if (error) console.error('[api/checkout/callback] order update (paid) failed:', error.message)
  } else if (statusId === '3') {
    const { error } = await supabaseAdmin.from('orders').update({ status: 'failed' }).eq('id', orderId)
    if (error) console.error('[api/checkout/callback] order update (failed) failed:', error.message)
  }
  // statusId === '2' (pending) — no-op, order already defaults to 'pending'.

  // ToyyibPay expects a 200 regardless of internal outcome, or it retries
  // the callback — always acknowledge receipt.
  res.status(200).send('OK')
}
