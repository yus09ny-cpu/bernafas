import { supabase } from '@/lib/supabase'

// The one direct-from-browser write to an affiliate table — RLS on
// affiliate_clicks allows anon insert specifically for this (see
// 0003_affiliate_program.sql), everything else affiliate-related goes
// through api/affiliate/*.ts. Fire-and-forget from BeliLandingScreen: a
// failed click log should never block the visitor from reaching checkout.
export async function recordAffiliateClick(username: string): Promise<void> {
  const { error } = await supabase.from('affiliate_clicks').insert({ affiliate_username: username })
  if (error) console.error('[affiliate] click insert failed:', error.message)
}

// AffiliateRegisterScreen.tsx calls this AFTER registerAffiliate below
// succeeds (never before — an auth account for a registration that then
// fails username/email uniqueness would be orphaned crud, see this
// function's caller for the exact ordering reasoning). Client-side
// supabase.auth.signUp (anon key), NOT the admin API — sends a real
// confirmation e-mail via Supabase's own mailer (same mechanism the app's
// magic-link already relies on), no custom email-sending code needed.
// Confirmation is REQUIRED before the password can be used to sign in
// (project-wide "Confirm email" setting, confirmed still on for this
// project) — deliberately not bypassed: an unconfirmed instant-access
// account would let anyone claim an EXISTING unlinked affiliate's email
// (several sit unlinked in production right now) and, via the existing
// auto-link-by-email logic, read that affiliate's real dashboard/history
// without ever proving they own the mailbox.
//
// emailRedirectTo (bug fix, 2026-08-21) — this call originally had NO
// emailRedirectTo at all, so the confirmation link fell back to
// Supabase's default Site URL (bare origin), landing a confirming
// affiliate on the main app's ConnectScreen instead of anywhere
// affiliate-related. Fixed by pointing it at /affiliate/log-masuk
// directly, NOT the sessionStorage bounce-back trick
// (markAffiliateOAuthRedirect) used for the Google OAuth redirect bug —
// that trick doesn't fit here: a confirmation link is opened from an
// email client, almost always in a FRESH tab/session that never ran the
// registration code, so sessionStorage set at signup time wouldn't be
// there to read. Confirmed empirically (generateLink + a real fetch
// against the actual verify link, redirect:'manual') that Supabase's
// redirect-URL allow-list already accepts this specific path — no
// dashboard changes needed. AffiliateLoginScreen.tsx's existing
// signed-in-on-mount handling (resolve to an affiliate via action=me,
// then the dashboard) already does exactly the right thing once the
// confirmation lands there, no new code needed on that end either.
export async function signUpAffiliateAuth(
  email: string,
  password: string,
): Promise<{ status: 'confirmation_sent' | 'existing_account' | 'error'; error?: string }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/affiliate/log-masuk` },
  })
  if (error) return { status: 'error', error: error.message }

  // Supabase's anti-enumeration behavior: signing up with an email that
  // already belongs to a CONFIRMED account returns no error, but an empty
  // `identities` array and no session — that's the only signal available
  // to tell "brand new account, confirmation email sent" apart from
  // "this email already has a login somewhere, nothing sent".
  const alreadyHasAccount = !data.session && (!data.user?.identities || data.user.identities.length === 0)
  return { status: alreadyHasAccount ? 'existing_account' : 'confirmation_sent' }
}

export interface AffiliateRegisterResult {
  id?: string
  username?: string
  status?: string
  error?: string
}

export async function registerAffiliate(input: {
  name: string
  email: string
  username: string
  referredBy?: string
}): Promise<AffiliateRegisterResult> {
  const response = await fetch('/api/affiliate?action=register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await response.json().catch(() => ({}))) as AffiliateRegisterResult
  if (!response.ok) return { error: data.error ?? 'Gagal mendaftar.' }
  return data
}

export interface AffiliateDashboardData {
  affiliate: { username: string; name: string; status: string }
  clickCount: number
  // Counted straight from `orders` (affiliate_ref = username) — see
  // api/affiliate.ts's handleDashboard comment on why (an order and its
  // commission row(s) are created at different times).
  confirmedSales: number
  pendingSales: number
  // RM totals, split by source ('sale' = affiliate's own sales,
  // 'referralOverride' = 5% from a downline's sales) and status.
  commissions: {
    sale: { pending: number; paid: number }
    referralOverride: { pending: number; paid: number }
  }
}

export async function fetchAffiliateDashboard(id: string): Promise<{ data: AffiliateDashboardData | null; error: string | null }> {
  const response = await fetch(`/api/affiliate?action=dashboard&id=${encodeURIComponent(id)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { data: null, error: data.error ?? 'Gagal muatkan dashboard.' }
  return { data: data as AffiliateDashboardData, error: null }
}

export async function fetchAffiliateBookUrl(username: string): Promise<{ url: string | null; error: string | null }> {
  const response = await fetch(`/api/affiliate?action=book&username=${encodeURIComponent(username)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { url: null, error: data.error ?? 'Gagal jana buku.' }
  return { url: data.url ?? null, error: null }
}

export interface AffiliateSelf {
  id: string
  username: string
  name: string
  status: string
}

// AffiliateLoginScreen.tsx's post-sign-in step — resolves the just-signed-in
// Supabase Auth session (Google OAuth or email magic-link, see useAuth.ts;
// this call doesn't care which) to the caller's OWN affiliate record,
// auto-linking it on first login (api/affiliate.ts's handleMe). Requires a
// real access_token, unlike the other affiliate calls above.
export async function fetchAffiliateMe(accessToken: string): Promise<{ data: AffiliateSelf | null; error: string | null }> {
  const response = await fetch('/api/affiliate?action=me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { data: null, error: data.error ?? 'Gagal semak akaun.' }
  return { data: data.affiliate as AffiliateSelf, error: null }
}

// useAuth's signInWithGoogle always redirects back to window.location.origin
// (bare origin, no path — see useAuth.ts's own comment on why: the target
// must be in Supabase Auth's redirect-URL allow-list, and only the bare
// origin is confirmed to be in it). That means a Google sign-in started
// from /affiliate/log-masuk OR /affiliate/daftar lands back on `/`
// (main.tsx's PublicRoot -> <App/>), not back on the screen that needs to
// run its own post-redirect step. sessionStorage (not localStorage —
// scoped to this tab, so an abandoned/cancelled attempt doesn't leave a
// stale flag that misroutes a LATER, unrelated visit to this site)
// carries the "bounce back to here" instruction across that redirect.
// main.tsx reads this before rendering anything. Used by both screens —
// the path itself tells main.tsx where to send the browser back to.
const OAUTH_REDIRECT_KEY = 'bernafas_affiliate_oauth_redirect'

export function markAffiliateOAuthRedirect(path: string): void {
  sessionStorage.setItem(OAUTH_REDIRECT_KEY, path)
}

// Preserves the current URL's search/hash (Supabase's OAuth callback
// params — a PKCE `?code=` or implicit-flow `#access_token=...`) onto the
// bounce-back target, so the Supabase client re-initialized on that page
// still sees them and completes session detection there instead of on `/`
// where nothing reads them.
export function consumeAffiliateOAuthRedirect(currentPathname: string): string | null {
  const target = sessionStorage.getItem(OAUTH_REDIRECT_KEY)
  if (!target || target === currentPathname) return null
  sessionStorage.removeItem(OAUTH_REDIRECT_KEY)
  return target + window.location.search + window.location.hash
}

// AffiliateRegisterScreen.tsx's "Daftar dengan Google" button — Google
// only supplies name/email, not a chosen username, so the name+username
// the user already typed into the form has to survive the SAME redirect
// round-trip as the OAuth flag above. Read back only when
// AffiliateRegisterScreen's own useEffect finds BOTH a 'signed-in' status
// AND this payload present — deliberately NOT triggered by just being
// signed in (unlike AffiliateLoginScreen, which always resolves on
// sign-in) so visiting /affiliate/daftar with an unrelated existing
// session never silently re-registers anything.
const REGISTER_OAUTH_PAYLOAD_KEY = 'bernafas_affiliate_register_oauth_payload'

interface RegisterOAuthPayload {
  name: string
  username: string
  referredBy?: string
}

export function markAffiliateRegisterOAuthPayload(payload: RegisterOAuthPayload): void {
  sessionStorage.setItem(REGISTER_OAUTH_PAYLOAD_KEY, JSON.stringify(payload))
}

export function consumeAffiliateRegisterOAuthPayload(): RegisterOAuthPayload | null {
  const raw = sessionStorage.getItem(REGISTER_OAUTH_PAYLOAD_KEY)
  if (!raw) return null
  sessionStorage.removeItem(REGISTER_OAUTH_PAYLOAD_KEY)
  try {
    return JSON.parse(raw) as RegisterOAuthPayload
  } catch {
    return null
  }
}
