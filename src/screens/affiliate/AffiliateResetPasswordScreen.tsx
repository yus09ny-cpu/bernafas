import { useEffect, useState } from 'react'
import { KeyRound, ArrowRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// /affiliate/reset-kata-laluan — the redirectTo target useAuth's
// sendPasswordReset (AffiliateLoginScreen.tsx's "Lupa kata laluan?") sends
// affiliates to. Supabase's client (detectSessionInUrl:true, see
// lib/supabase.ts) parses the recovery token in the URL on load and fires
// a PASSWORD_RECOVERY auth event with a temporary session — listened for
// directly here (not via useAuth's simplified 'signed-in' status) so this
// screen can tell "here to set a new password" apart from "already fully
// signed in for an unrelated reason".
//
// After a successful supabase.auth.updateUser({ password }), that
// temporary session IS a real session — redirecting to
// /affiliate/log-masuk lets its existing signed-in-on-mount handling
// (resolve to an affiliate record via action=me, then the dashboard) run
// as-is, rather than duplicating that resolve step a third time here.
type Phase = 'waiting' | 'ready' | 'invalid' | 'saving' | 'done'

export default function AffiliateResetPasswordScreen() {
  const [phase, setPhase] = useState<Phase>('waiting')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setPhase('ready')
      }
    })

    // If the PASSWORD_RECOVERY event already fired before this listener
    // attached (detectSessionInUrl can resolve very fast), fall back to
    // checking for a session directly after a short beat.
    const fallback = setTimeout(() => {
      setPhase(current => {
        if (current !== 'waiting') return current
        return 'invalid'
      })
    }, 3000)

    return () => {
      subscription.subscription.unsubscribe()
      clearTimeout(fallback)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (phase !== 'ready') return
    if (password.length < 8) {
      setError('Kata laluan mesti sekurang-kurangnya 8 aksara.')
      return
    }
    if (password !== confirmPassword) {
      setError('Kata laluan tidak sepadan.')
      return
    }
    setError(null)
    setPhase('saving')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setPhase('ready')
      return
    }
    setPhase('done')
    window.location.href = '/affiliate/log-masuk'
  }

  return (
    <div
      className="flex h-full flex-col items-center justify-between overflow-y-auto px-6 py-10 text-center"
      style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="text-2xl font-extrabold tracking-tight text-[var(--color-primary-dark)]">Bernafas</span>
        <span className="text-sm text-[var(--color-text-muted)]">Set Semula Kata Laluan</span>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-full bg-white/70"
          style={{ boxShadow: '0 10px 40px rgba(63,140,140,0.15)' }}
        >
          {phase === 'waiting' || phase === 'saving' ? (
            <Loader2 size={56} className="animate-spin text-[var(--color-accent)]" />
          ) : (
            <KeyRound size={56} className="text-[var(--color-accent)]" />
          )}
        </div>

        {(phase === 'waiting' || phase === 'saving') && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {phase === 'waiting' ? 'Mengesahkan pautan…' : 'Menyimpan kata laluan baharu…'}
          </p>
        )}

        {phase === 'invalid' && (
          <div className="flex flex-col items-center gap-3">
            <p className="max-w-xs text-sm text-[var(--color-warm)]">
              Pautan set semula tidak sah atau telah luput. Sila minta pautan baharu.
            </p>
            <a
              href="/affiliate/log-masuk"
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95"
            >
              Kembali ke Log Masuk <ArrowRight size={18} />
            </a>
          </div>
        )}

        {phase === 'ready' && (
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
            <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
              Masukkan kata laluan baharu anda.
            </p>
            {error && <p className="max-w-xs text-sm text-[var(--color-warm)]">{error}</p>}
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Kata laluan baharu"
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
              disabled={!password || !confirmPassword}
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
            >
              Simpan Kata Laluan <ArrowRight size={18} />
            </button>
          </form>
        )}
      </div>

      <span className="text-xs text-[var(--color-text-muted)]">&nbsp;</span>
    </div>
  )
}
