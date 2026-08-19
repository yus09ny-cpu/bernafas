// Spec item 6 — 30-day attribution cookie for /beli?ref=USERNAME. Plain
// document.cookie (no library) — one cookie, one call site (BeliLandingScreen),
// doesn't warrant pulling in a cookie package.
const COOKIE_NAME = 'bernafas_affiliate_ref'
const COOKIE_MAX_AGE_DAYS = 30

export function setAffiliateRefCookie(ref: string): void {
  const maxAgeSeconds = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(ref)}; max-age=${maxAgeSeconds}; path=/; samesite=lax`
}

export function getAffiliateRefCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}
