import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { hasAdminRole } from '../_lib/adminRole.js'

// GET/POST /api/admin/shipping — merged from separate
// api/admin/shipping-list.ts + api/admin/shipping-update.ts files
// (2026-08-20, same Vercel Hobby 12-function-cap consolidation as
// api/shipping.ts — see that file's own header for the full story).
interface UpdateShippingBody {
  shippingId?: string
  trackingNumber?: string | null
}

async function handleList(res: VercelResponse) {
  const { data, error } = await supabaseAdmin
    .from('order_shipping')
    .select('id, order_id, recipient_name, phone, address, postcode, state, shipping_status, tracking_number, created_at, orders(product_type, amount, email)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[api/admin/shipping GET] query failed:', error.message)
    res.status(500).json({ error: 'Gagal muatkan senarai penghantaran.' })
    return
  }

  res.status(200).json({ shipments: data ?? [] })
}

async function handleUpdate(req: VercelRequest, res: VercelResponse) {
  const { shippingId, trackingNumber } = (req.body ?? {}) as UpdateShippingBody
  if (typeof shippingId !== 'string' || !shippingId) {
    res.status(400).json({ error: 'shippingId diperlukan.' })
    return
  }

  const { error } = await supabaseAdmin
    .from('order_shipping')
    .update({
      shipping_status: 'dihantar',
      tracking_number: trackingNumber?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shippingId)

  if (error) {
    console.error('[api/admin/shipping POST] update failed:', error.message)
    res.status(500).json({ error: 'Gagal kemas kini status.' })
    return
  }

  res.status(200).json({ success: true })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req)
  // /admin/penghantaran is reachable by any admin tier — 'admin' (shipping
  // only), 'super', or 'master' — see supabase/migrations/0007_admin_roles.sql.
  if (!(await hasAdminRole(user, 'admin'))) {
    res.status(403).json({ error: 'Tiada akses.' })
    return
  }

  if (req.method === 'GET') return handleList(res)
  if (req.method === 'POST') return handleUpdate(req, res)
  res.status(405).json({ error: 'Method not allowed' })
}
