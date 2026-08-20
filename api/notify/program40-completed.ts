import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { sendAdminNotification } from '../_lib/adminNotify.js'

// POST /api/notify/program40-completed — called by
// src/lib/program40/enrollment.ts's recomputeEnrollmentProgress right
// after it writes status='completed'. That write happens on EVERY session
// save once a user has covered all 40 distinct days (not just the first
// time) — this endpoint is what makes the ONE admin notice actually fire
// only once: check-and-set completed_notified_at atomically-enough for a
// solo-owner low-traffic feature (a user finishing two sessions within
// milliseconds of each other is not a real scenario worth building
// row-locking for).
//
// This is a NOTICE for the product owner to manually follow up on bonus
// content (Fasa 2-4, extra books, Live Praktikal) later — NOT an
// automated delivery system. Spec is explicit that automated bonus
// delivery is out of scope until that content actually exists.
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

  const { data: enrollment, error } = await supabaseAdmin
    .from('program_40_day_enrollment')
    .select('status, completed_notified_at, start_date')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[api/notify/program40-completed] enrollment lookup failed:', error.message)
    res.status(500).json({ error: 'Gagal semak status program.' })
    return
  }

  if (!enrollment || enrollment.status !== 'completed' || enrollment.completed_notified_at) {
    // Not an error — most calls land here (not completed yet, or already
    // notified). Silent no-op, matches recordCommissionsForPaidOrder's own
    // idempotency-guard style (commissions.ts).
    res.status(200).json({ notified: false })
    return
  }

  const { error: updateError } = await supabaseAdmin
    .from('program_40_day_enrollment')
    .update({ completed_notified_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[api/notify/program40-completed] guard update failed:', updateError.message)
    res.status(500).json({ error: 'Gagal tanda notis.' })
    return
  }

  await sendAdminNotification(
    '🎉 Pengguna selesai Program 40 Hari',
    [
      `E-mel: ${user.email}`,
      `Tarikh mula: ${enrollment.start_date}`,
      `Tarikh selesai: ${new Date().toISOString().slice(0, 10)}`,
      '',
      'Follow-up manual untuk bonus (Fasa 2-4, 3 buku tambahan, Live Praktikal) bila kandungan dah sedia.',
    ].join('\n'),
  )

  res.status(200).json({ notified: true })
}
