import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { isAdmin } from '../_lib/isAdmin.js'

// GET /api/admin/shipping-list — every order_shipping row, newest first,
// joined with its order (product_type/amount/email) for context. No
// status filter server-side — AdminShippingScreen.tsx filters
// belum_hantar/dihantar client-side (small list, no pagination need yet).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await verifyUser(req)
  if (!user || !isAdmin(user)) {
    res.status(403).json({ error: 'Tiada akses.' })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('order_shipping')
    .select('id, order_id, recipient_name, phone, address, postcode, state, shipping_status, tracking_number, created_at, orders(product_type, amount, email)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[api/admin/shipping-list] query failed:', error.message)
    res.status(500).json({ error: 'Gagal muatkan senarai penghantaran.' })
    return
  }

  res.status(200).json({ shipments: data ?? [] })
}
