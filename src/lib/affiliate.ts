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

export async function registerAffiliate(input: { name: string; email: string; username: string }): Promise<AffiliateRegisterResult> {
  const response = await fetch('/api/affiliate/register', {
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
  // Counted straight from `orders` (affiliate_ref = username), not from
  // affiliate_commissions — see api/affiliate/dashboard.ts's own comment on
  // why: no code creates commission rows yet (rate undecided), so counting
  // from that table always read 0 even after a real sale.
  confirmedSales: number
  pendingSales: number
}

export async function fetchAffiliateDashboard(id: string): Promise<{ data: AffiliateDashboardData | null; error: string | null }> {
  const response = await fetch(`/api/affiliate/dashboard?id=${encodeURIComponent(id)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { data: null, error: data.error ?? 'Gagal muatkan dashboard.' }
  return { data: data as AffiliateDashboardData, error: null }
}

export async function fetchAffiliateBookUrl(username: string): Promise<{ url: string | null; error: string | null }> {
  const response = await fetch(`/api/affiliate/book?username=${encodeURIComponent(username)}`)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { url: null, error: data.error ?? 'Gagal jana buku.' }
  return { url: data.url ?? null, error: null }
}
