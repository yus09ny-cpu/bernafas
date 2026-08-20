import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { isAdmin } from '../_lib/isAdmin.js'

// POST /api/admin/shipping-update — marks one order_shipping row
// 'dihantar' (the "Tandakan Dihantar" button), optionally recording a
// tracking number in the same call. One-way: no route back to
// 'belum_hantar' exists yet — not asked for, and re-marking an already
// shipped order as unshipped is more likely a mistake than a real need.
interface UpdateShippingBody {
  shippingId?: string
  trackingNumber?: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await verifyUser(req)
  if (!user || !isAdmin(user)) {
    res.status(403).json({ error: 'Tiada akses.' })
    return
  }

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
    console.error('[api/admin/shipping-update] update failed:', error.message)
    res.status(500).json({ error: 'Gagal kemas kini status.' })
    return
  }

  res.status(200).json({ success: true })
}
