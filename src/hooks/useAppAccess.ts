import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AppAccessReason = 'subscription' | 'lifetime' | 'admin' | null

export interface AppAccessState {
  status: 'loading' | 'granted' | 'blocked'
  reason: AppAccessReason
  subscriptionExpiry: string | null
  recheck: () => void
}

// Backs App.tsx's gate (wired 2026-08-20) — calls api/app-access/status.ts
// with the current session's access_token. Re-fetches whenever `session`
// changes (covers sign-in/sign-out) and exposes `recheck` for the
// post-checkout-redirect case: ToyyibPay's billReturnUrl lands the browser
// back on the normal app shell before the async payment-callback webhook
// is guaranteed to have landed, so SubscriptionRequiredScreen offers a
// manual recheck rather than the user being stuck on a stale 'blocked'
// render.
export function useAppAccess(session: Session | null): AppAccessState {
  const [status, setStatus] = useState<AppAccessState['status']>('loading')
  const [reason, setReason] = useState<AppAccessReason>(null)
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null)

  const check = useCallback(async () => {
    const token = session?.access_token
    if (!token) {
      setStatus('blocked')
      return
    }
    setStatus('loading')
    try {
      const response = await fetch('/api/app-access/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (!response.ok) {
        console.error('[useAppAccess] status check failed:', data.error)
        setStatus('blocked')
        return
      }
      setReason(data.reason ?? null)
      setSubscriptionExpiry(data.subscriptionExpiry ?? null)
      setStatus(data.hasAccess ? 'granted' : 'blocked')
    } catch (err) {
      console.error('[useAppAccess] status check errored:', err)
      setStatus('blocked')
    }
  }, [session?.access_token])

  useEffect(() => {
    check()
  }, [check])

  return { status, reason, subscriptionExpiry, recheck: check }
}
