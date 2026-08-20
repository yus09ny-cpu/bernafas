import { useState } from 'react'
import { Users, ArrowRight, CheckCircle2 } from 'lucide-react'
import { registerAffiliate } from '@/lib/affiliate'

// /affiliate/daftar — public, no auth (affiliates are a separate identity
// from Bernafas app users, see 0003_affiliate_program.sql's header
// comment). Uniqueness of username is enforced server-side (api/affiliate/
// register.ts, DB unique constraint) — this form just surfaces whatever
// error comes back, it doesn't pre-check itself.
//
// ?ref=USERNAME_UPLINE (2-tier referral override, commissions.ts) is read
// once at module-render time — no cookie, unlike BeliLandingScreen's
// 30-day one: registration is a single immediate action (land, fill form,
// submit), not a funnel that might resume days later. A missing/invalid
// ref is resolved server-side (register.ts) to "no referral", never
// blocks signup.
const referredBy = new URLSearchParams(window.location.search).get('ref') ?? undefined

export default function AffiliateRegisterScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState<{ id: string; username: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || !name.trim() || !email.trim() || !username.trim()) return
    setSubmitting(true)
    setError(null)
    const result = await registerAffiliate({ name, email, username, referredBy })
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setRegistered({ id: result.id!, username: result.username! })
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
          <CheckCircle2 size={56} className="text-[var(--color-primary)]" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Pendaftaran diterima</h1>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
            Simpan pautan dashboard anda, atau log masuk bila-bila masa guna e-mel ini di{' '}
            <a href="/affiliate/log-masuk" className="underline">/affiliate/log-masuk</a>.
          </p>
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
          <button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim() || !username.trim()}
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
