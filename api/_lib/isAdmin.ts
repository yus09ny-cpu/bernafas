import type { VerifiedUser } from './verifyUser.js'

// Solo-owner project — no roles table anywhere in this repo (unlike
// madrasah-iam's profiles.role='master_admin'). A single hardcoded email
// check, same "this is the only admin there will ever be" reasoning
// AffiliateDashboardScreen.tsx's own access-control comment already
// accepts for this codebase (that screen's access control IS just the
// affiliateId in the URL — no login at all). Configurable via ADMIN_EMAIL
// without a redeploy; falls back to the product owner's own address if
// unset.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'yus09ny@gmail.com'

export function isAdmin(user: VerifiedUser | null): boolean {
  return user?.email === ADMIN_EMAIL
}
