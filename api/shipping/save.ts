import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { sendAdminNotification } from '../_lib/adminNotify.js'

// POST /api/shipping/save — the one-time shipping-address capture for a
// paid 'sensor'/'pakej_lifetime' order. 'buku' and 'app_subscription'
// orders are never eligible — nothing physical ships for either.
const SHIPPING_ELIGIBLE_PRODUCT_TYPES = ['sensor', 'pakej_lifetime']

interface SaveShippingBody {
  orderId?: string
  recipientName?: string
  phone?: string
  address?: string
  postcode?: string
  state?: string
}

function requireNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await verifyUser(req)
  if (!user) {
    res.status(401).json({ error: 'Sila log masuk dahulu.' })
    return
  }

  const { orderId, recipientName, phone, address, postcode, state } = (req.body ?? {}) as SaveShippingBody
  if (
    !requireNonEmpty(orderId) ||
    !requireNonEmpty(recipientName) ||
    !requireNonEmpty(phone) ||
    !requireNonEmpty(address) ||
    !requireNonEmpty(postcode) ||
    !requireNonEmpty(state)
  ) {
    res.status(400).json({ error: 'Semua ruangan (nama, telefon, alamat, poskod, negeri) diperlukan.' })
    return
  }

  // Ownership + eligibility check — same user_id-or-email pattern as
  // api/book/full.ts and api/app-access/status.ts (orders may carry only
  // an email for a guest /beli checkout, not user_id).
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, product_type, amount, email')
    .eq('id', orderId)
    .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
    .in('product_type', SHIPPING_ELIGIBLE_PRODUCT_TYPES)
    .eq('status', 'paid')
    .maybeSingle()

  if (orderError) {
    console.error('[api/shipping/save] order lookup failed:', orderError.message)
    res.status(500).json({ error: 'Gagal semak order.' })
    return
  }
  if (!order) {
    res.status(403).json({ error: 'Order tidak sah, belum dibayar, atau bukan milik anda.' })
    return
  }

  // "Sekali sahaja" — a second submission for the same order is rejected,
  // not silently overwritten. maybeSingle (not a count) so we can hand the
  // already-saved status back for the client to show instead of a bare
  // error.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('order_shipping')
    .select('id, shipping_status, tracking_number')
    .eq('order_id', orderId)
    .maybeSingle()

  if (existingError) {
    console.error('[api/shipping/save] existing-shipping check failed:', existingError.message)
    res.status(500).json({ error: 'Gagal semak status penghantaran.' })
    return
  }
  if (existing) {
    res.status(409).json({
      error: 'Alamat penghantaran untuk order ini sudah disimpan.',
      shippingStatus: existing.shipping_status,
      trackingNumber: existing.tracking_number,
    })
    return
  }

  const { error: insertError } = await supabaseAdmin.from('order_shipping').insert({
    order_id: orderId,
    recipient_name: recipientName.trim(),
    phone: phone.trim(),
    address: address.trim(),
    postcode: postcode.trim(),
    state: state.trim(),
  })

  if (insertError) {
    console.error('[api/shipping/save] insert failed:', insertError.message)
    res.status(500).json({ error: 'Gagal simpan alamat.' })
    return
  }

  await sendAdminNotification(
    `📦 Order baharu perlu dihantar — ${order.product_type}`,
    [
      `Produk: ${order.product_type}`,
      `Jumlah: RM${order.amount}`,
      `E-mel pembeli: ${order.email ?? user.email}`,
      '',
      `Nama penerima: ${recipientName.trim()}`,
      `Telefon: ${phone.trim()}`,
      `Alamat: ${address.trim()}`,
      `Poskod: ${postcode.trim()}`,
      `Negeri: ${state.trim()}`,
      '',
      `Order ID: ${order.id}`,
    ].join('\n'),
  )

  res.status(200).json({ success: true })
}
