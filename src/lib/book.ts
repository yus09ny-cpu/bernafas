import { supabase } from '@/lib/supabase'

// Client-side helper for the purchase-gated full (13-bab) book —
// api/book/full.ts. Distinct from src/lib/affiliate.ts's
// fetchAffiliateBookUrl (the free 2-bab excerpt, no auth) — this one always
// requires a session, since the endpoint itself does.
export async function fetchFullBookUrl(): Promise<{ url: string | null; error: string | null; notPurchased: boolean }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { url: null, error: 'Sila log masuk dahulu.', notPurchased: false }

  const response = await fetch('/api/book/full', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      url: null,
      error: data.error ?? 'Gagal jana buku.',
      notPurchased: data.code === 'NOT_PURCHASED',
    }
  }
  return { url: data.url ?? null, error: null, notPurchased: false }
}
