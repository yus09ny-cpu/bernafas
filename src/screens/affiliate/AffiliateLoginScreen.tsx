import { useEffect, useState } from 'react'
import { Mail, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { fetchAffiliateMe, markAffiliateOAuthRedirect } from '@/lib/affiliate'

// /affiliate/log-masuk — spec item 3: a SEPARATE login screen from the
// regular app's AuthScreen.tsx, even though both reuse the exact same
// useAuth hook/Supabase Auth session underneath (Google OAuth + email
// magic-link — no new auth mechanism built, per the spec's own "guna cara
// paling ringkas/reuse dahulu" instruction; real email+password was
// considered and NOT built, since magic-link is already the app-wide
// passwordless pattern and needs zero new backend work). Separate screen
// because an affiliate isn't necessarily a Bernafas app user (see
// 0003_affiliate_program.sql's header) — this screen's whole job after a
// successful sign-in is resolving that session to an AFFILIATE record
// (api/affiliate.ts's action=me, auto-links on first login) and landing on
// the existing /affiliate/dashboard/:id screen, not App.tsx's tab shell.
//
// If the same person is already signed in on this browser (e.g. they're
// also a regular app user, or logged in here before), `status` starts as
// 'signed-in' immediately on mount — resolveAffiliate below runs right
// away without waiting for a button press.
export default function AffiliateLoginScreen() {
  const { status, error: authError, sendMagicLink, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'signed-in') return
    let cancelled = false
    setResolving(true)
    setResolveError(null)
    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token
      if (!token) {
        if (!cancelled) {
          setResolving(false)
          setResolveError('Sesi tidak sah. Sila cuba log masuk semula.')
        }
        return
      }
      const { data: affiliate, error } = await fetchAffiliateMe(token)
      if (cancelled) return
      setResolving(false)
      if (error || !affiliate) {
        setResolveError(error ?? 'Gagal semak akaun.')
        return
      }
      window.location.href = `/affiliate/dashboard/${affiliate.id}`
    })
    return () => {
      cancelled = true
    }
  }, [status])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || submitting) return
    setSubmitting(true)
    await sendMagicLink(email.trim())
    setSubmitting(false)
  }

  const handleGoogle = async () => {
    if (googleSubmitting) return
    setGoogleSubmitting(true)
    // Google's redirect always lands back on `/` (see markAffiliateOAuthRedirect's
    // own comment) — this flag is what sends the browser back here to
    // finish resolving the session to an affiliate record.
    markAffiliateOAuthRedirect('/affiliate/log-masuk')
    const ok = await signInWithGoogle()
    if (!ok) setGoogleSubmitting(false)
  }

  const linkSent = status === 'link-sent'

  // Signed in and resolving/resolved (or failed to resolve) — a different
  // small screen from the sign-in form below, not a full reload of it.
  if (status === 'signed-in') {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center"
        style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
      >
        {resolving && (
          <>
            <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
            <p className="text-sm text-[var(--color-text-muted)]">Menyemak akaun affiliate anda…</p>
          </>
        )}
        {!resolving && resolveError && (
          <div className="flex flex-col items-center gap-3">
            <p className="max-w-xs text-sm text-[var(--color-warm)]">{resolveError}</p>
            <a
              href="/affiliate/daftar"
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95"
            >
              Daftar sebagai Affiliate <ArrowRight size={18} />
            </a>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col items-center justify-between overflow-y-auto px-6 py-10 text-center"
      style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="text-2xl font-extrabold tracking-tight text-[var(--color-primary-dark)]">Bernafas</span>
        <span className="text-sm text-[var(--color-text-muted)]">Log Masuk Affiliate</span>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-full bg-white/70 transition-all duration-500"
          style={{ boxShadow: '0 10px 40px rgba(63,140,140,0.15)' }}
        >
          {linkSent ? (
            <CheckCircle2 size={56} className="text-[var(--color-primary)]" />
          ) : (
            <Mail size={56} className="text-[var(--color-accent)]" />
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            {linkSent ? 'Semak e-mel anda' : 'Log masuk ke dashboard affiliate'}
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
            {linkSent
              ? `Pautan log masuk telah dihantar ke ${email}. Buka e-mel itu pada peranti ini untuk masuk.`
              : 'Guna e-mel yang sama semasa anda mendaftar sebagai affiliate.'}
          </p>
          {authError && <p className="max-w-xs text-sm text-[var(--color-warm)]">{authError}</p>}
        </div>

        {!linkSent && (
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@contoh.com"
              className="w-full rounded-full border border-[var(--color-card-border)] bg-white/80 px-5 py-4 text-center text-base text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            />
            <button
              type="submit"
              disabled={submitting || !email.trim()}
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
            >
              {submitting ? 'Menghantar...' : 'Hantar pautan log masuk'} <ArrowRight size={18} />
            </button>
          </form>
        )}

        {!linkSent && (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--color-card-border)] opacity-30" />
              <span className="text-xs text-[var(--color-text-muted)]">atau</span>
              <div className="h-px flex-1 bg-[var(--color-card-border)] opacity-30" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleSubmitting}
              className="flex items-center justify-center gap-3 rounded-full border border-[var(--color-card-border)] bg-white/80 px-6 py-4 text-base font-medium text-[var(--color-text)] transition-transform active:scale-95 disabled:opacity-40"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {googleSubmitting ? 'Menyambung...' : 'Teruskan dengan Google'}
            </button>
          </div>
        )}

        {!linkSent && (
          <a href="/affiliate/daftar" className="text-xs text-[var(--color-text-muted)] underline-offset-4 hover:underline">
            Belum daftar? Daftar sebagai affiliate
          </a>
        )}

        {linkSent && (
          <button
            onClick={() => window.location.reload()}
            className="rounded-full px-6 py-3 text-sm font-medium text-[var(--color-text-muted)] underline-offset-4 hover:underline"
          >
            Guna e-mel lain
          </button>
        )}
      </div>

      <span className="text-xs text-[var(--color-text-muted)]">&nbsp;</span>
    </div>
  )
}
