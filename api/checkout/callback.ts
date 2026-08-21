import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { markOrderPaid } from '../_lib/markOrderPaid.js'

// ToyyibPay's server-to-server callback (billCallbackUrl in create-bill.ts)
// — POSTs application/x-www-form-urlencoded, not JSON. status_id: 1 = paid,
// 2 = pending, 3 = failed (ToyyibPay's own convention). On a paid order,
// markOrderPaid (api/_lib/markOrderPaid.ts, extracted 2026-08-21 — this
// file was its only caller until api/checkout/manual-payment.ts's
// admin-approve action needed the identical sequence for the Wise
// (Antarabangsa) manual-payment path) flips orders.status to 'paid' and
// handles every downstream effect: commission calculation, app_subscription
// extension, and auto-affiliate-on-purchase. See that file's own header
// for the full reasoning — never re-implement any of this here again.
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
    const result = await markOrderPaid(orderId)
    if (!result.success) {
      console.error('[api/checkout/callback] markOrderPaid failed:', result.error)
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
