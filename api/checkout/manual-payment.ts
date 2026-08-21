import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { hasAdminRole } from '../_lib/adminRole.js'
import { markOrderPaid } from '../_lib/markOrderPaid.js'
import { PRODUCT_PRICES, isProductType } from '../_lib/pricing.js'

// api/checkout/manual-payment.ts — "Wise (Antarabangsa)" manual payment
// path, for buyers outside Malaysia (ToyyibPay only processes MYR). Four
// actions in one file (branched on `action` query param, same
// consolidation pattern as api/affiliate.ts / api/admin/shipping.ts —
// Vercel Hobby's 12-function cap, still in effect as of this feature:
// confirmed directly against the Vercel API before writing any of this,
// team is still on "hobby", not yet upgraded):
//
// - action=submit (POST, no auth — matches /beli's guest-checkout model):
//   buyer uploads a payment-proof screenshot + e-mail. Creates the order
//   as 'pending_verification' (NOT 'paid' — that only happens via
//   action=approve, which reuses markOrderPaid.ts, the SAME logic
//   ToyyibPay's webhook uses) plus a manual_payment_proofs row, and
//   uploads the image to the private 'manual-payment-proofs' Storage
//   bucket.
// - action=list (GET, hasAdminRole 'admin'): pending proofs + signed
//   image URLs, for AdminManualPaymentScreen.tsx.
// - action=approve (POST, hasAdminRole 'admin'): calls markOrderPaid —
//   never duplicates that logic, per explicit instruction.
// - action=reject (POST, hasAdminRole 'admin'): marks the proof
//   'rejected', order is left exactly as it was ('pending_verification',
//   never flips to 'paid').
const STORAGE_BUCKET = 'manual-payment-proofs'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // matches the bucket's own fileSizeLimit
const ALLOWED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

interface SubmitBody {
  productType?: string
  email?: string
  imageBase64?: string
  imageContentType?: string
}

async function handleSubmit(req: VercelRequest, res: VercelResponse) {
  const { productType, email, imageBase64, imageContentType } = (req.body ?? {}) as SubmitBody

  if (!isProductType(productType)) {
    res.status(400).json({ error: "productType mesti 'buku', 'pakej_lifetime', 'sensor', atau 'app_subscription'." })
    return
  }
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    res.status(400).json({ error: 'E-mel diperlukan.' })
    return
  }
  if (!imageBase64 || !imageContentType || !ALLOWED_CONTENT_TYPES.includes(imageContentType)) {
    res.status(400).json({ error: 'Gambar bukti bayaran diperlukan (PNG, JPEG, atau WEBP).' })
    return
  }

  let imageBuffer: Buffer
  try {
    imageBuffer = Buffer.from(imageBase64, 'base64')
  } catch {
    res.status(400).json({ error: 'Gambar tidak sah.' })
    return
  }
  if (imageBuffer.length === 0 || imageBuffer.length > MAX_IMAGE_BYTES) {
    res.status(400).json({ error: 'Saiz gambar mesti antara 1 bait dan 5MB.' })
    return
  }

  // Optional auth — same as create-bill.ts: /beli stays guest-friendly,
  // but if the visitor already has a session, attach user_id so the
  // resulting order is tied to their account too.
  const verifiedUser = await verifyUser(req)
  const amount = PRODUCT_PRICES[productType]

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      product_type: productType,
      amount,
      email: verifiedUser?.email ?? normalizedEmail,
      user_id: verifiedUser?.id ?? null,
      status: 'pending_verification',
    })
    .select('id')
    .single()

  if (orderError) {
    console.error('[api/checkout/manual-payment action=submit] order insert failed:', orderError.message)
    res.status(500).json({ error: 'Gagal cipta order.' })
    return
  }

  const extension = EXTENSION_BY_CONTENT_TYPE[imageContentType]
  const proofImagePath = `${order.id}/${Date.now()}.${extension}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(proofImagePath, imageBuffer, { contentType: imageContentType, upsert: false })

  if (uploadError) {
    console.error('[api/checkout/manual-payment action=submit] storage upload failed:', uploadError.message)
    // Order already exists at this point — leave it as
    // 'pending_verification' with no proof row rather than deleting it;
    // an admin can see it's stuck and the buyer can be asked to retry.
    // Not auto-cleaned up here to keep this handler's failure mode simple
    // (no cascading delete logic in a request that's already failing).
    res.status(500).json({ error: 'Gagal muat naik gambar. Sila cuba lagi.' })
    return
  }

  const { error: proofError } = await supabaseAdmin.from('manual_payment_proofs').insert({
    order_id: order.id,
    proof_image_path: proofImagePath,
    submitted_email: normalizedEmail,
    status: 'pending',
  })

  if (proofError) {
    console.error('[api/checkout/manual-payment action=submit] proof insert failed:', proofError.message)
    res.status(500).json({ error: 'Gagal simpan rekod bukti bayaran.' })
    return
  }

  res.status(201).json({ orderId: order.id })
}

async function handleList(res: VercelResponse) {
  const { data, error } = await supabaseAdmin
    .from('manual_payment_proofs')
    .select('id, order_id, proof_image_path, submitted_email, status, reviewed_by, reviewed_at, created_at, orders(product_type, amount, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[api/checkout/manual-payment action=list] query failed:', error.message)
    res.status(500).json({ error: 'Gagal muatkan senarai bukti bayaran.' })
    return
  }

  const proofs = await Promise.all(
    (data ?? []).map(async proof => {
      const { data: signed } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(proof.proof_image_path, 60 * 10)
      return { ...proof, imageUrl: signed?.signedUrl ?? null }
    }),
  )

  res.status(200).json({ proofs })
}

interface ReviewBody {
  proofId?: string
}

async function handleApprove(req: VercelRequest, res: VercelResponse, adminEmail: string) {
  const { proofId } = (req.body ?? {}) as ReviewBody
  if (!proofId) {
    res.status(400).json({ error: 'proofId diperlukan.' })
    return
  }

  const { data: proof, error: proofError } = await supabaseAdmin
    .from('manual_payment_proofs')
    .select('id, order_id, status')
    .eq('id', proofId)
    .maybeSingle()

  if (proofError) {
    console.error('[api/checkout/manual-payment action=approve] proof lookup failed:', proofError.message)
    res.status(500).json({ error: 'Gagal cari rekod bukti bayaran.' })
    return
  }
  if (!proof) {
    res.status(404).json({ error: 'Bukti bayaran tidak dijumpai.' })
    return
  }
  if (proof.status !== 'pending') {
    res.status(409).json({ error: `Bukti bayaran ini sudah ${proof.status === 'approved' ? 'disahkan' : 'ditolak'}.` })
    return
  }

  // The SAME order-paid logic ToyyibPay's real webhook uses — see
  // markOrderPaid.ts's own header. If this fails, the proof stays
  // 'pending' (not marked approved) so it can be retried instead of
  // silently losing track of a real payment.
  const result = await markOrderPaid(proof.order_id)
  if (!result.success) {
    console.error('[api/checkout/manual-payment action=approve] markOrderPaid failed:', result.error)
    res.status(500).json({ error: 'Gagal tandakan order sebagai dibayar.' })
    return
  }

  const { error: updateError } = await supabaseAdmin
    .from('manual_payment_proofs')
    .update({ status: 'approved', reviewed_by: adminEmail, reviewed_at: new Date().toISOString() })
    .eq('id', proofId)

  if (updateError) {
    // Order IS already paid at this point (markOrderPaid succeeded) —
    // this is a bookkeeping-only failure, surfaced but not reversed.
    console.error('[api/checkout/manual-payment action=approve] proof status update failed:', updateError.message)
    res.status(500).json({ error: 'Order ditandakan dibayar, tetapi gagal kemas kini rekod bukti bayaran.' })
    return
  }

  res.status(200).json({ success: true })
}

async function handleReject(req: VercelRequest, res: VercelResponse, adminEmail: string) {
  const { proofId } = (req.body ?? {}) as ReviewBody
  if (!proofId) {
    res.status(400).json({ error: 'proofId diperlukan.' })
    return
  }

  const { data: proof, error: proofError } = await supabaseAdmin
    .from('manual_payment_proofs')
    .select('id, status')
    .eq('id', proofId)
    .maybeSingle()

  if (proofError) {
    console.error('[api/checkout/manual-payment action=reject] proof lookup failed:', proofError.message)
    res.status(500).json({ error: 'Gagal cari rekod bukti bayaran.' })
    return
  }
  if (!proof) {
    res.status(404).json({ error: 'Bukti bayaran tidak dijumpai.' })
    return
  }
  if (proof.status !== 'pending') {
    res.status(409).json({ error: `Bukti bayaran ini sudah ${proof.status === 'approved' ? 'disahkan' : 'ditolak'}.` })
    return
  }

  // Order deliberately left untouched — stays 'pending_verification',
  // never flips to 'paid'. No buyer notification in this first version
  // (spec: "pertimbang notis... tapi tak wajib").
  const { error: updateError } = await supabaseAdmin
    .from('manual_payment_proofs')
    .update({ status: 'rejected', reviewed_by: adminEmail, reviewed_at: new Date().toISOString() })
    .eq('id', proofId)

  if (updateError) {
    console.error('[api/checkout/manual-payment action=reject] proof status update failed:', updateError.message)
    res.status(500).json({ error: 'Gagal kemas kini rekod bukti bayaran.' })
    return
  }

  res.status(200).json({ success: true })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = typeof req.query.action === 'string' ? req.query.action : null

  if (req.method === 'POST' && action === 'submit') return handleSubmit(req, res)

  // Everything past this point is admin-only — /admin/bayaran-manual,
  // same tier as /admin/penghantaran (any of master/super/admin).
  if (action === 'list' || action === 'approve' || action === 'reject') {
    const user = await verifyUser(req)
    if (!(await hasAdminRole(user, 'admin'))) {
      res.status(403).json({ error: 'Tiada akses.' })
      return
    }
    if (req.method === 'GET' && action === 'list') return handleList(res)
    if (req.method === 'POST' && action === 'approve') return handleApprove(req, res, user!.email)
    if (req.method === 'POST' && action === 'reject') return handleReject(req, res, user!.email)
  }

  res.status(404).json({ error: 'Unknown action.' })
}
