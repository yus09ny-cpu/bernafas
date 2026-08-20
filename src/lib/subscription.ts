import { supabase } from '@/lib/supabase'

// Client-side helpers for the RM19.90/bulan app-access subscription
// (profiles.subscription_tier/subscription_expiry — see
// supabase/migrations/0005_sensor_and_subscription.sql). Deliberately NOT
// used anywhere to gate rendering yet — App.tsx still grants full access to
// every signed-in user regardless of what this returns. That's a separate,
// later decision (see this migration's own header) — these functions exist
// so the subscribe-and-check UI (AccountMenu.tsx) is fully testable now,
// not so the gate is silently already live somewhere.

export interface SubscriptionStatus {
  tier: 'free' | 'active'
  expiresAt: string | null
}

export async function fetchSubscriptionStatus(userId: string): Promise<{ data: SubscriptionStatus | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_expiry')
    .eq('id', userId)
    .single()

  if (error) return { data: null, error: error.message }
  return {
    data: { tier: data.subscription_tier as 'free' | 'active', expiresAt: data.subscription_expiry },
    error: null,
  }
}

// Starts a RM19.90 ToyyibPay bill for the signed-in caller and returns the
// URL to redirect to. Requires an active session — api/checkout/create-bill.ts
// rejects productType 'app_subscription' with no Authorization header (a
// subscription only means something tied to a specific profile).
export async function startAppSubscriptionCheckout(): Promise<{ paymentUrl: string | null; error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { paymentUrl: null, error: 'Sila log masuk dahulu.' }

  const response = await fetch('/api/checkout/create-bill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ productType: 'app_subscription' }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) return { paymentUrl: null, error: data.error ?? 'Gagal mula langganan.' }
  if (!data.paymentUrl) return { paymentUrl: null, error: data.warning ?? 'Pembayaran belum tersedia buat masa ini.' }
  return { paymentUrl: data.paymentUrl, error: null }
}
