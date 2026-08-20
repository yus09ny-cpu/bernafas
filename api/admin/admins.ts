import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { verifyUser } from '../_lib/verifyUser.js'
import { hasAdminRole, type AdminRole } from '../_lib/adminRole.js'

// GET/POST /api/admin/admins — master-only. Lists current admins (any of
// the 3 tiers) and sets/clears one profile's admin_role. This is the ONLY
// route that can grant/change/revoke admin access itself — every other
// api/admin/*.ts route only ever READS admin_role to gate itself, never
// writes it (see supabase/migrations/0007_admin_roles.sql's header).
const VALID_ROLES: AdminRole[] = ['master', 'super', 'admin']

interface SetRoleBody {
  email?: string
  role?: AdminRole | null
}

async function handleList(res: VercelResponse) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, admin_role, created_at')
    .not('admin_role', 'is', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[api/admin/admins GET] query failed:', error.message)
    res.status(500).json({ error: 'Gagal muatkan senarai admin.' })
    return
  }

  res.status(200).json({ admins: data ?? [] })
}

async function handleSetRole(req: VercelRequest, res: VercelResponse) {
  const { email, role } = (req.body ?? {}) as SetRoleBody
  const normalizedEmail = email?.trim().toLowerCase()

  if (!normalizedEmail) {
    res.status(400).json({ error: 'email diperlukan.' })
    return
  }
  if (role !== null && role !== undefined && !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: 'role tidak sah.' })
    return
  }
  // undefined and null both mean "remove admin status" (admin_role -> NULL)
  const nextRole: AdminRole | null = role ?? null

  // Users only get a `profiles` row via the on_auth_user_created trigger
  // after their first real sign-in (0001_init.sql) — there's no
  // pre-provisioning of accounts in this app, so an admin can only be
  // granted to someone who has already signed in at least once.
  const { data: target, error: findError } = await supabaseAdmin
    .from('profiles')
    .select('id, admin_role')
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (findError) {
    console.error('[api/admin/admins POST] lookup failed:', findError.message)
    res.status(500).json({ error: 'Gagal cari pengguna.' })
    return
  }
  if (!target) {
    res.status(404).json({ error: 'Pengguna belum pernah log masuk ke app ini. Minta mereka log masuk sekali (magic link) dahulu, kemudian cuba lagi.' })
    return
  }

  // Guard: never let the last master admin lose master status (demoted or
  // removed). /admin/pengurusan-admin itself is master-only, so an empty
  // master set would permanently lock everyone out of managing admins at
  // all — the same "never leave the admin system empty" reasoning the
  // seed migration already applies at setup time, extended to every
  // subsequent change too.
  if (target.admin_role === 'master' && nextRole !== 'master') {
    const { count, error: countError } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('admin_role', 'master')

    if (countError) {
      console.error('[api/admin/admins POST] master-count check failed:', countError.message)
      res.status(500).json({ error: 'Gagal sahkan status master admin.' })
      return
    }
    if ((count ?? 0) <= 1) {
      res.status(400).json({ error: 'Tidak boleh keluarkan master admin terakhir.' })
      return
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ admin_role: nextRole })
    .eq('id', target.id)

  if (updateError) {
    console.error('[api/admin/admins POST] update failed:', updateError.message)
    res.status(500).json({ error: 'Gagal kemas kini role.' })
    return
  }

  res.status(200).json({ success: true })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req)
  if (!(await hasAdminRole(user, 'master'))) {
    res.status(403).json({ error: 'Tiada akses.' })
    return
  }

  if (req.method === 'GET') return handleList(res)
  if (req.method === 'POST') return handleSetRole(req, res)
  res.status(405).json({ error: 'Method not allowed' })
}
