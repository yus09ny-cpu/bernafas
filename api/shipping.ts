import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'
import { verifyUser } from './_lib/verifyUser.js'
import { sendAdminNotification } from './_lib/adminNotify.js'

// GET/POST /api/shipping — merged from separate api/shipping/mine.ts +
// api/shipping/save.ts files (2026-08-20): Vercel's Hobby plan caps a
// deployment at 12 Serverless Functions — this repo hit 13 and every
// deploy failed silently after "Deploying outputs..." with no error
// surfaced in `vercel logs`/`inspect --logs` (confirmed live: the build
// itself succeeded, tsc/vite both clean, only the deploy step failed).
// One file branching on req.method costs the same as either endpoint
// alone did separately — no behavior change from the split version, pure
// function-count consolidation. If more shipping endpoints are ever
// needed, prefer adding a method/action branch here over a new file.
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

async function handleMine(user: { id: string; email: string }, res: VercelResponse) {
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
    console.error('[api/shipping GET] order lookup failed:', error.message)
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

async function handleSave(user: { id: string; email: string }, req: VercelRequest, res: VercelResponse) {
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

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, product_type, amount, email')
    .eq('id', orderId)
    .or(`user_id.eq.${user.id},email.ilike.${user.email}`)
    .in('product_type', SHIPPING_ELIGIBLE_PRODUCT_TYPES)
    .eq('status', 'paid')
    .maybeSingle()

  if (orderError) {
    console.error('[api/shipping POST] order lookup failed:', orderError.message)
    res.status(500).json({ error: 'Gagal semak order.' })
    return
  }
  if (!order) {
    res.status(403).json({ error: 'Order tidak sah, belum dibayar, atau bukan milik anda.' })
    return
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('order_shipping')
    .select('id, shipping_status, tracking_number')
    .eq('order_id', orderId)
    .maybeSingle()

  if (existingError) {
    console.error('[api/shipping POST] existing-shipping check failed:', existingError.message)
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
    console.error('[api/shipping POST] insert failed:', insertError.message)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req)
  if (!user) {
    res.status(401).json({ error: 'Sila log masuk dahulu.' })
    return
  }

  if (req.method === 'GET') return handleMine(user, res)
  if (req.method === 'POST') return handleSave(user, req, res)
  res.status(405).json({ error: 'Method not allowed' })
}
