import { useState } from 'react'
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

// Gate screen shown before anything else in the app (see App.tsx) —
// unauthenticated users see this instead of the tab shell/connect screen.
// Two sign-in paths, both landing in the same auth.users/profiles rows via
// useAuth: email magic link (no password, no OTP code to type, and no SMS
// provider/billing needed — Supabase sends the email itself) and Google
// OAuth (supabase.auth.signInWithOAuth, full-page redirect). Same pastel
// visual language as ConnectScreen.
export default function AuthScreen() {
  const { status, error, sendMagicLink, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)

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
    const ok = await signInWithGoogle()
    // Only reset on failure — success navigates the page away to Google,
    // so there's no "after" moment to reset state at.
    if (!ok) setGoogleSubmitting(false)
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
