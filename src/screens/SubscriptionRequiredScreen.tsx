import { useState } from 'react'
import { Lock, RefreshCw, Loader2 } from 'lucide-react'
import { startAppSubscriptionCheckout } from '@/lib/subscription'

interface SubscriptionRequiredScreenProps {
  recheck: () => void
}

// Shown by App.tsx in place of the tab shell when useAppAccess() resolves
// to 'blocked' — a signed-in user with neither an active RM19.90/bulan
// subscription nor a paid pakej_lifetime order. Same pastel visual
// language as AuthScreen (this screen sits directly after it in the same
// gate chain: signed-out -> AuthScreen, signed-in-but-not-subscribed ->
// this).
//
// "Semak semula" exists specifically for the post-ToyyibPay-redirect
// moment: billReturnUrl lands the browser back here before the async
// payment-callback webhook is guaranteed to have landed yet — a manual
// recheck (useAppAccess's `recheck`) avoids the user being stuck looking
// at a stale block right after paying.
export default function SubscriptionRequiredScreen({ recheck }: SubscriptionRequiredScreenProps) {
  const [subscribing, setSubscribing] = useState(false)
  const [rechecking, setRechecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async () => {
    if (subscribing) return
    setSubscribing(true)
    setError(null)
    const { paymentUrl, error } = await startAppSubscriptionCheckout()
    if (error || !paymentUrl) {
      setError(error ?? 'Gagal mula langganan.')
      setSubscribing(false)
      return
    }
    window.location.href = paymentUrl
  }

  const handleRecheck = () => {
    if (rechecking) return
    setRechecking(true)
    recheck()
    // useAppAccess's status flips this screen away entirely once granted —
    // reset just in case access is still blocked after the recheck.
    setTimeout(() => setRechecking(false), 1500)
  }

  return (
    <div
      className="flex h-full flex-col items-center justify-between overflow-y-auto px-6 py-10 text-center"
      style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="text-2xl font-extrabold tracking-tight text-[var(--color-primary-dark)]">Bernafas</span>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-full bg-white/70"
          style={{ boxShadow: '0 10px 40px rgba(63,140,140,0.15)' }}
        >
          <Lock size={56} className="text-[var(--color-accent)]" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Langganan diperlukan</h1>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
            Akses aplikasi bernafas.my memerlukan langganan aktif — RM19.90/bulan, atau termasuk selamanya dalam Pakej
            Lifetime.
          </p>
          {error && <p className="max-w-xs text-sm text-[var(--color-warm)]">{error}</p>}
        </div>

        <div className="flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={subscribing}
            className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            {subscribing ? <Loader2 size={18} className="animate-spin" /> : 'Langgan RM19.90/bulan'}
          </button>

          <a
            href="/beli"
            className="rounded-full border border-[var(--color-card-border)] bg-white/80 px-6 py-4 text-base font-medium text-[var(--color-text)] transition-transform active:scale-95"
          >
            Lihat Pakej Lifetime
          </a>

          <button
            type="button"
            onClick={handleRecheck}
            disabled={rechecking}
            className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-[var(--color-text-muted)] disabled:opacity-40"
          >
            <RefreshCw size={14} className={rechecking ? 'animate-spin' : ''} />
            {rechecking ? 'Menyemak...' : 'Sudah bayar? Semak semula'}
          </button>
        </div>
      </div>

      <span className="text-xs text-[var(--color-text-muted)]">&nbsp;</span>
    </div>
  )
}
