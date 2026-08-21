import { useState } from 'react'
import { Users, ArrowRight, CheckCircle2, MailCheck } from 'lucide-react'
import { registerAffiliate, signUpAffiliateAuth } from '@/lib/affiliate'

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
// ?ref=USERNAME_UPLINE (2-tier referral override, commissions.ts) is read
// once at module-render time — no cookie, unlike BeliLandingScreen's
// 30-day one: registration is a single immediate action (land, fill form,
// submit), not a funnel that might resume days later. A missing/invalid
// ref is resolved server-side (register.ts) to "no referral", never
// blocks signup.
const referredBy = new URLSearchParams(window.location.search).get('ref') ?? undefined

type AuthOutcome = 'confirmation_sent' | 'existing_account' | 'auth_failed'

export default function AffiliateRegisterScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState<{ id: string; username: string; authOutcome: AuthOutcome; authError?: string } | null>(null)

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
      </div>

      <a href="/affiliate/log-masuk" className="text-xs text-[var(--color-text-muted)] underline-offset-4 hover:underline">
        Sudah ada akaun? Log masuk
      </a>
    </div>
  )
}
