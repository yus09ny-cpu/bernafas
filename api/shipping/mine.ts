import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'

// GET /api/shipping/mine — every shipping-eligible order this user has
// (could be more than one — e.g. bought 'sensor' once, 'pakej_lifetime'
// later), each with its shipping state: not yet submitted (no
// order_shipping row — client should show the address form),
// 'belum_hantar' (submitted, not shipped), or 'dihantar' (shipped,
// tracking_number if the admin entered one).
const SHIPPING_ELIGIBLE_PRODUCT_TYPES = ['sensor', 'pakej_lifetime']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await verifyUser(req)
  if (!user) {
    res.status(401).json({ error: 'Sila log masuk dahulu.' })
    return
  }

  // order_shipping(...) — PostgREST embed via the order_shipping.order_id
  // FK, one order -> zero-or-one shipping row (order_id is unique on that
  // table) — comes back as an array of 0 or 1 elements per Supabase's own
  // embed convention for a to-many-shaped FK read.
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id, product_type, amount, paid_at, order_shipping(shipping_status, tracking_number)')
    .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
    .in('product_type', SHIPPING_ELIGIBLE_PRODUCT_TYPES)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })

  if (error) {
    console.error('[api/shipping/mine] order lookup failed:', error.message)
    res.status(500).json({ error: 'Gagal semak pesanan.' })
    return
  }

  const result = (orders ?? []).map(order => {
    const shipping = Array.isArray(order.order_shipping) ? order.order_shipping[0] : order.order_shipping
    return {
      orderId: order.id,
      productType: order.product_type,
      amount: order.amount,
      paidAt: order.paid_at,
      shippingSubmitted: Boolean(shipping),
      shippingStatus: shipping?.shipping_status ?? null,
      trackingNumber: shipping?.tracking_number ?? null,
    }
  })

  res.status(200).json({ orders: result })
}
