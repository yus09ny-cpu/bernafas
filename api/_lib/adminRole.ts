import type { VerifiedUser } from './verifyUser.js'
import { supabaseAdmin } from './supabaseAdmin.js'

// 3-tier admin role system (supabase/migrations/0007_admin_roles.sql),
// replacing the old single-hardcoded-email isAdmin() check. Hierarchy is
// strict and linear — master ⊇ super ⊇ admin — so "does this user have at
// least role X" is a plain rank comparison, not a set-membership check.
// 'master' additionally has exclusive access to managing OTHER admins'
// roles (api/admin/admins.ts) — that's gated by requiring exactly
// 'master', not just "highest rank", so keep using hasAdminRole(user,
// 'master') there rather than assuming rank alone implies it (it does
// here since master is the top rank, but the naming is deliberately
// role-based, not just numeric, in case the hierarchy ever grows a
// sibling branch).
export type AdminRole = 'master' | 'super' | 'admin'

const ROLE_RANK: Record<AdminRole, number> = { admin: 1, super: 2, master: 3 }

// Always reads live from `profiles` (service-role, bypasses RLS) rather
// than trusting anything the client claims — same reasoning verifyUser
// already applies to the access token itself.
export async function getAdminRole(user: VerifiedUser | null): Promise<AdminRole | null> {
  if (!user) return null

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('admin_role')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data?.admin_role) return null
  return data.admin_role as AdminRole
}

// true if the user's role meets or exceeds `minimum` in the master > super
// > admin hierarchy. Use this (not getAdminRole directly) in every
// api/admin/*.ts route guard.
export async function hasAdminRole(user: VerifiedUser | null, minimum: AdminRole): Promise<boolean> {
  const role = await getAdminRole(user)
  if (!role) return false
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}
