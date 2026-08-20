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
// from /affiliate/log-masuk lands back on `/` (main.tsx's PublicRoot ->
// <App/>), not back on the login screen that needs to run the
// resolve-affiliate step. sessionStorage (not localStorage — scoped to
// this tab, so an abandoned/cancelled attempt doesn't leave a stale flag
// that misroutes a LATER, unrelated visit to this site) carries the
// "bounce back to here" instruction across that redirect. main.tsx reads
// this before rendering anything.
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
