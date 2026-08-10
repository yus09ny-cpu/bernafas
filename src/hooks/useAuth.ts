import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type AuthStatus = 'loading' | 'signed-out' | 'link-sent' | 'signed-in'

// Wraps Supabase's own session state — persisted in localStorage by the
// client (see supabase.ts's persistSession:true), so a returning user who
// already completed the magic-link flow lands straight on 'signed-in'
// without re-entering their email. supabase-js also auto-detects the
// #access_token=... fragment a magic link redirects to and exchanges it
// for a session (detectSessionInUrl:true) — onAuthStateChange below is what
// picks that up and flips status to 'signed-in', no manual token handling
// needed here.
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setStatus(data.session ? 'signed-in' : 'signed-out')
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setStatus(newSession ? 'signed-in' : 'signed-out')
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const sendMagicLink = useCallback(async (email: string) => {
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Where Supabase redirects back to after the link is clicked — must
        // be in the project's Auth > URL Configuration allow-list
        // (dashboard-only setting, not something a migration/API call can
        // set) or Supabase silently falls back to its default Site URL
        // instead of this one.
        emailRedirectTo: window.location.origin,
      },
    })
    if (signInError) {
      setError(signInError.message)
      return false
    }
    setStatus('link-sent')
    return true
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Same redirect target as sendMagicLink above — must be in the
        // project's Auth > URL Configuration allow-list or Supabase falls
        // back to its default Site URL instead of this one.
        redirectTo: window.location.origin,
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      return false
    }
    // No setStatus('link-sent') here: unlike the magic-link flow, this
    // navigates the whole page away to Google immediately, so there's
    // nothing to render locally while it's pending. onAuthStateChange
    // above picks up 'signed-in' once Google redirects back with a
    // session, same as the magic-link fragment handoff.
    return true
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return { session, status, error, sendMagicLink, signInWithGoogle, signOut }
}
