import { useState } from 'react'
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

// Gate screen shown before anything else in the app (see App.tsx) —
// unauthenticated users see this instead of the tab shell/connect screen.
// Email + magic link only: no password, no OTP code to type, and no SMS
// provider/billing needed (unlike phone OTP, which Supabase can't send
// without a connected Twilio-style account) — Supabase sends the email
// itself. Same pastel visual language as ConnectScreen.
export default function AuthScreen() {
  const { status, error, sendMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || submitting) return
    setSubmitting(true)
    await sendMagicLink(email.trim())
    setSubmitting(false)
  }

  const linkSent = status === 'link-sent'

  return (
    <div
      className="flex h-full flex-col items-center justify-between overflow-y-auto px-6 py-10 text-center"
      style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="text-2xl font-extrabold tracking-tight text-[var(--color-primary-dark)]">Bernafas</span>
        <span className="text-sm text-[var(--color-text-muted)]">Tenang, satu nafas pada satu masa</span>
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
            {linkSent ? 'Semak e-mel anda' : 'Log masuk untuk teruskan'}
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
            {linkSent
              ? `Pautan log masuk telah dihantar ke ${email}. Buka e-mel itu pada peranti ini untuk masuk.`
              : 'Masukkan e-mel anda — kami hantar pautan log masuk, tiada kata laluan diperlukan.'}
          </p>
          {error && <p className="max-w-xs text-sm text-[var(--color-warm)]">{error}</p>}
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
