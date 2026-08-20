import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { recordAffiliateClick } from '@/lib/affiliate'
import { setAffiliateRefCookie, getAffiliateRefCookie } from '@/lib/affiliateCookie'
import { supabase } from '@/lib/supabase'

// /beli?ref=USERNAME — spec item 6. Sets the 30-day attribution cookie and
// logs the click ONLY when a ref is actually present in the URL (a direct
// /beli visit with no ref leaves any existing cookie from an earlier
// affiliate visit untouched — that's the whole point of a 30-day
// window: the buyer doesn't have to purchase on the same visit).
// Prices below are the book's own stated prices (RM35 buku / RM499 pakej
// lifetime / RM350 sensor-only — the actual amount charged is decided
// server-side, api/_lib/pricing.ts; these are display copies of that same
// source of truth, kept in sync by hand same as the original 2 always were).
const PRODUCTS = [
  { type: 'buku' as const, label: 'Buku "Ini Jantungmu"', amount: 35 },
  { type: 'sensor' as const, label: 'Sensor Sahaja', amount: 350 },
  { type: 'pakej_lifetime' as const, label: 'Pakej Buku + Sensor + Aplikasi (Lifetime)', amount: 499 },
]

export default function BeliLandingScreen() {
  const [submittingType, setSubmittingType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) {
      setAffiliateRefCookie(ref)
      recordAffiliateClick(ref)
    }
  }, [])

  const handleBuy = async (productType: string) => {
    if (submittingType) return
    setSubmittingType(productType)
    setError(null)
    setWarning(null)
    try {
      // /beli stays guest-friendly (no login required — see this file's
      // own header comment) — but if the visitor already happens to have a
      // session (e.g. an existing app user clicking their own /beli link),
      // attach it so the resulting order gets user_id set server-side
      // instead of relying solely on the email they type in later.
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const response = await fetch('/api/checkout/create-bill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ productType, affiliateRef: getAffiliateRefCookie() }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Gagal mula pembelian.')
        return
      }
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
        return
      }
      setWarning(data.warning ?? 'Pembayaran belum tersedia buat masa ini.')
    } finally {
      setSubmittingType(null)
    }
  }

  return (
    <div
      className="flex h-full w-full flex-col items-center gap-8 overflow-y-auto px-6 py-10 text-center"
      style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="text-2xl font-extrabold tracking-tight text-[var(--color-primary-dark)]">Bernafas</span>
        <span className="max-w-xs text-sm text-[var(--color-text-muted)]">"Ini Jantungmu — Dengarkan Dia Bercakap"</span>
      </div>

      {error && <p className="max-w-xs text-sm text-[var(--color-warm)]">{error}</p>}
      {warning && <p className="max-w-xs text-sm text-[var(--color-text-muted)]">{warning}</p>}

      <div className="flex w-full max-w-xs flex-col gap-3">
        {PRODUCTS.map(product => (
          <button
            key={product.type}
            type="button"
            onClick={() => handleBuy(product.type)}
            disabled={submittingType !== null}
            className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-5 py-4 text-left transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            <span className="text-sm font-semibold text-[var(--color-text)]">{product.label}</span>
            <span className="flex shrink-0 items-center gap-2 text-base font-bold text-[var(--color-primary)]">
              {submittingType === product.type ? <Loader2 size={16} className="animate-spin" /> : `RM${product.amount}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
