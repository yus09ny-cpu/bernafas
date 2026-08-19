import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { recordAffiliateClick } from '@/lib/affiliate'
import { setAffiliateRefCookie, getAffiliateRefCookie } from '@/lib/affiliateCookie'

// /beli?ref=USERNAME — spec item 6. Sets the 30-day attribution cookie and
// logs the click ONLY when a ref is actually present in the URL (a direct
// /beli visit with no ref leaves any existing cookie from an earlier
// affiliate visit untouched — that's the whole point of a 30-day
// window: the buyer doesn't have to purchase on the same visit).
// Prices below are the book's own stated prices (RM35 buku / RM499 pakej
// lifetime, from buku/INI_JANTUNGMU_template.docx's own marketing copy),
// not a number invented for this screen — separate from the UNSET
// affiliate commission rate, which is a different number entirely.
const PRODUCTS = [
  { type: 'buku' as const, label: 'Buku "Ini Jantungmu"', amount: 35 },
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

  const handleBuy = async (productType: string, amount: number) => {
    if (submittingType) return
    setSubmittingType(productType)
    setError(null)
    setWarning(null)
    try {
      const response = await fetch('/api/checkout/create-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productType, amount, affiliateRef: getAffiliateRefCookie() }),
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
            onClick={() => handleBuy(product.type, product.amount)}
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
