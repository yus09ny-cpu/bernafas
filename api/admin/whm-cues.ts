import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyUser } from '../_lib/verifyUser.js'
import { hasAdminRole } from '../_lib/adminRole.js'

// Pure gate check for /admin/whm-cues (src/screens/admin/WhmCueRecorderScreen.tsx)
// — the recorder itself reads/writes nothing in Supabase (it only times
// button taps against the video and copies the result to the clipboard for
// manual pasting into src/data/whmCues.ts), so this route has no data to
// serve, same hasAdminRole('admin') gate every other /admin/* route uses.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const user = await verifyUser(req)
  if (!(await hasAdminRole(user, 'admin'))) {
    res.status(403).json({ error: 'Tiada akses.' })
    return
  }

  res.status(200).json({ ok: true })
}
