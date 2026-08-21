import { useEffect, useState } from 'react'
import { Users, ArrowRight, CheckCircle2, MailCheck, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  registerAffiliate,
  signUpAffiliateAuth,
  fetchAffiliateMe,
  markAffiliateOAuthRedirect,
  markAffiliateRegisterOAuthPayload,
  consumeAffiliateRegisterOAuthPayload,
} from '@/lib/affiliate'

// /affiliate/daftar — public, no auth (affiliates are a separate identity
// from Bernafas app users, see 0003_affiliate_program.sql's header
// comment). Uniqueness of username is enforced server-side (api/affiliate.ts's
// register action, DB unique constraint) — this form just surfaces
// whatever error comes back, it doesn't pre-check itself.
//
// Also collects a real password (2026-08-21 — Google OAuth or magic-link
// alone wasn't what was asked for; see AffiliateLoginScreen.tsx's header
// for the correction) via signUpAffiliateAuth AFTER the affiliate row
// itself is created — see handleSubmit's own comment on why that order.
//
// "Daftar dengan Google" (2026-08-21, same day) — a SEPARATE path from the
// password form, not a replacement: name+username are typed into the form
// as normal (Google supplies email/identity verification, not a chosen
// username), then Google authenticates instead of a typed password. Same
// sessionStorage redirect-survival trick as AffiliateLoginScreen.tsx's
// Google button, PLUS a second payload (markAffiliateRegisterOAuthPayload)
// carrying {name, username} across the redirect, since a fresh page load
// after Google's callback has lost whatever was in the form's React state.
// After the round trip, registerAffiliate runs with the Google-verified
// email, then fetchAffiliateMe links it (same auto-link infra every other
// affiliate auth path already uses) and this screen redirects straight to
// the dashboard — no "check your e-mail" interstitial, since Google
// already fully verified identity in one step (unlike the password path,
// which still needs a real confirmation click).
//
// ?ref=USERNAME_UPLINE (2-tier referral override, commissions.ts) is read
// once at module-render time — no cookie, unlike BeliLandingScreen's
// 30-day one: registration is a single immediate action (land, fill form,
// submit), not a funnel that might resume days later. A missing/invalid
// ref is resolved server-side (register.ts) to "no referral", never
// blocks signup.
const referredBy = new URLSearchParams(window.location.search).get('ref') ?? undefined

type AuthOutcome = 'confirmation_sent' | 'existing_account' | 'auth_failed' | 'link_failed'

export default function AffiliateRegisterScreen() {
  const { status: authStatus, signInWithGoogle } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState<{ id: string; username: string; authOutcome: AuthOutcome; authError?: string } | null>(null)

  const [resolvingGoogle, setResolvingGoogle] = useState(false)

  // Only acts when BOTH a signed-in session AND a pending register-OAuth
  // payload are present — see this file's header for why "just signed in"
  // alone is deliberately not enough (unlike AffiliateLoginScreen.tsx).
  useEffect(() => {
    if (authStatus !== 'signed-in') return
    const payload = consumeAffiliateRegisterOAuthPayload()
    if (!payload) return

    let cancelled = false
    setResolvingGoogle(true)
    setError(null)

    supabase.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token
      const googleEmail = data.session?.user?.email
      if (!token || !googleEmail) {
        if (!cancelled) {
          setResolvingGoogle(false)
          setError('Sesi Google tidak sah. Sila cuba semula.')
        }
        return
      }

      const result = await registerAffiliate({ name: payload.name, email: googleEmail, username: payload.username, referredBy: payload.referredBy })
      if (cancelled) return
      if (result.error) {
        setResolvingGoogle(false)
        setError(result.error)
        return
      }

      // Auto-link (same infra every other affiliate auth path uses) —
      // the row was just created unlinked, action=me finds it by the
      // exact email match and links it in one call.
      const { data: linked, error: linkError } = await fetchAffiliateMe(token)
      if (cancelled) return
      setResolvingGoogle(false)
      if (linkError || !linked) {
        // Registration itself succeeded — surface the dashboard link
        // manually rather than losing the affiliate entirely over a
        // linking hiccup.
        setRegistered({ id: result.id!, username: result.username!, authOutcome: 'link_failed' })
        return
      }
      window.location.href = `/affiliate/dashboard/${linked.id}`
    })

    return () => {
      cancelled = true
    }
  }, [authStatus])

  const handleGoogleSignup = async () => {
    if (googleSubmitting || !name.trim() || !username.trim()) return
    setGoogleSubmitting(true)
    markAffiliateRegisterOAuthPayload({ name: name.trim(), username: username.trim(), referredBy })
    markAffiliateOAuthRedirect('/affiliate/daftar')
    const ok = await signInWithGoogle()
    if (!ok) setGoogleSubmitting(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || !name.trim() || !email.trim() || !username.trim() || !password) return
    if (password.length < 8) {
      setError('Kata laluan mesti sekurang-kurangnya 8 aksara.')
      return
    }
    if (password !== confirmPassword) {
      setError('Kata laluan tidak sepadan.')
      return
    }
    setSubmitting(true)
    setError(null)

    // Order matters: register the affiliate row FIRST (server-side,
    // enforces username/email uniqueness) and only set up login
    // credentials on success — never the other way round, which could
    // leave an orphaned unconfirmed auth account behind a registration
    // that then fails validation. See signUpAffiliateAuth's own comment
    // for why confirmation isn't skipped.
    const result = await registerAffiliate({ name, email, username, referredBy })
    if (result.error) {
      setSubmitting(false)
      setError(result.error)
      return
    }

    const authResult = await signUpAffiliateAuth(email.trim(), password)
    setSubmitting(false)
    setRegistered({
      id: result.id!,
      username: result.username!,
      authOutcome: authResult.status === 'error' ? 'auth_failed' : authResult.status,
      authError: authResult.error,
    })
  }

  if (resolvingGoogle) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center"
        style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
      >
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
        <p className="text-sm text-[var(--color-text-muted)]">Menyelesaikan pendaftaran melalui Google…</p>
      </div>
    )
  }

  if (registered) {
    const dashboardUrl = `${window.location.origin}/affiliate/dashboard/${registered.id}`
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-10 text-center"
        style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
      >
        <div
          className="flex h-44 w-44 items-center justify-center rounded-full bg-white/70"
          style={{ boxShadow: '0 10px 40px rgba(63,140,140,0.15)' }}
        >
          {registered.authOutcome === 'confirmation_sent' ? (
            <MailCheck size={56} className="text-[var(--color-primary)]" />
          ) : (
            <CheckCircle2 size={56} className="text-[var(--color-primary)]" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Pendaftaran diterima</h1>
          {registered.authOutcome === 'confirmation_sent' && (
            <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
              Sila semak e-mel anda ({email}) dan klik pautan pengesahan sebelum log masuk kali pertama di{' '}
              <a href="/affiliate/log-masuk" className="underline">/affiliate/log-masuk</a>.
            </p>
          )}
          {registered.authOutcome === 'existing_account' && (
            <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
              E-mel ini sudah mempunyai akaun log masuk sedia ada — log masuk terus guna kaedah asal anda di{' '}
              <a href="/affiliate/log-masuk" className="underline">/affiliate/log-masuk</a>.
            </p>
          )}
          {registered.authOutcome === 'auth_failed' && (
            <p className="max-w-xs text-sm leading-relaxed text-[var(--color-warm)]">
              Pendaftaran affiliate berjaya, tetapi gagal menyediakan kata laluan ({registered.authError}). Guna
              "Lupa kata laluan?" di{' '}
              <a href="/affiliate/log-masuk" className="underline">/affiliate/log-masuk</a> untuk menetapkannya.
            </p>
          )}
          {registered.authOutcome === 'link_failed' && (
            <p className="max-w-xs text-sm leading-relaxed text-[var(--color-warm)]">
              Pendaftaran affiliate berjaya melalui Google, tetapi gagal mengaitkan akaun secara automatik. Sila log
              masuk semula di{' '}
              <a href="/affiliate/log-masuk" className="underline">/affiliate/log-masuk</a>.
            </p>
          )}
        </div>
        <div className="w-full max-w-xs break-all rounded-2xl bg-white/70 p-4 text-sm text-[var(--color-primary-dark)]">
          {dashboardUrl}
        </div>
        <a
          href={`/affiliate/dashboard/${registered.id}`}
          className="flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95"
        >
          Ke Dashboard Saya <ArrowRight size={18} />
        </a>
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
        <span className="text-sm text-[var(--color-text-muted)]">Program Affiliate</span>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-full bg-white/70"
          style={{ boxShadow: '0 10px 40px rgba(63,140,140,0.15)' }}
        >
          <Users size={56} className="text-[var(--color-accent)]" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Daftar sebagai Affiliate</h1>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
            Kongsi buku "Ini Jantungmu" dengan pautan anda sendiri.
          </p>
          {error && <p className="max-w-xs text-sm text-[var(--color-warm)]">{error}</p>}
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nama penuh"
            className="w-full rounded-full border border-[var(--color-card-border)] bg-white/80 px-5 py-4 text-center text-base text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
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
          <input
            type="text"
            required
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            placeholder="username-anda"
            className="w-full rounded-full border border-[var(--color-card-border)] bg-white/80 px-5 py-4 text-center text-base text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
          <p className="text-xs text-[var(--color-text-muted)]">
            Pautan anda: bernafas.my/beli?ref={username || 'username-anda'}
          </p>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Kata laluan (min. 8 aksara)"
            className="w-full rounded-full border border-[var(--color-card-border)] bg-white/80 px-5 py-4 text-center text-base text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Sahkan kata laluan"
            className="w-full rounded-full border border-[var(--color-card-border)] bg-white/80 px-5 py-4 text-center text-base text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />
          <button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim() || !username.trim() || !password.trim()}
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            {submitting ? 'Mendaftar...' : 'Daftar'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-card-border)] opacity-30" />
            <span className="text-xs text-[var(--color-text-muted)]">atau</span>
            <div className="h-px flex-1 bg-[var(--color-card-border)] opacity-30" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleSubmitting || !name.trim() || !username.trim()}
            className="flex items-center justify-center gap-3 rounded-full border border-[var(--color-card-border)] bg-white/80 px-6 py-4 text-base font-medium text-[var(--color-text)] transition-transform active:scale-95 disabled:opacity-40"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {googleSubmitting ? 'Menyambung...' : 'Daftar dengan Google'}
          </button>
          {!name.trim() || !username.trim() ? (
            <p className="text-[11px] text-[var(--color-text-muted)]">Isi nama dan username dahulu untuk daftar dengan Google.</p>
          ) : null}
        </div>
      </div>

      <a href="/affiliate/log-masuk" className="text-xs text-[var(--color-text-muted)] underline-offset-4 hover:underline">
        Sudah ada akaun? Log masuk
      </a>
    </div>
  )
}
