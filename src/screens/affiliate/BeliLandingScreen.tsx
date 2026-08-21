import { useEffect, useState } from 'react'
import { Loader2, Upload, CheckCircle2, ExternalLink } from 'lucide-react'
import { recordAffiliateClick } from '@/lib/affiliate'
import { setAffiliateRefCookie, getAffiliateRefCookie } from '@/lib/affiliateCookie'
import { submitManualPaymentProof } from '@/lib/manualPayment'
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

// 2026-08-21 — "Wise (Antarabangsa)" manual payment path for buyers
// outside Malaysia (ToyyibPay only processes MYR).
//
// Real Wise payment link + QR (added 2026-08-21, same day) — BOTH are
// tied to a single fixed Wise payment REQUEST the product owner created
// (confirmed by inspecting the QR image: it encodes "Amount: 9 SGD, Note:
// Ebook.. Ini Jantungmu"), not a generic "pay any amount" account. That
// only actually matches the 'buku' product — showing it for
// sensor/pakej_lifetime would display the wrong amount/note to a buyer
// paying for something else. Per explicit product-owner decision, the
// QR/link are gated to 'buku' only (see WISE_SUPPORTED_PRODUCT below);
// other products show a "not yet available via Wise" notice instead of a
// mismatched QR.
const WISE_LINK = 'https://wise.com/pay/r/j_NBrhu0i_oe7o4'
const WISE_QR_IMAGE = '/assets/wise-qr.png'
const WISE_SUPPORTED_PRODUCT = 'buku' as const

type PaymentMethod = 'toyyibpay' | 'wise'
type ProductType = (typeof PRODUCTS)[number]['type']

// Purely a display aid for the buyer to include in their Wise transfer
// note, so the admin can eyeball-match an incoming Wise transfer to a
// submission later — NOT persisted anywhere (manual_payment_proofs' given
// schema has no reference column; submitted_email + amount + the
// screenshot itself are what's actually stored and reviewed). Generated
// client-side, never sent to the server.
function generateWiseReference(productType: string): string {
  const code = productType.slice(0, 4).toUpperCase()
  const random = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `BERNAFAS-${code}-${random}`
}

export default function BeliLandingScreen() {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('toyyibpay')
  const [submittingType, setSubmittingType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  // Wise flow state — only relevant while paymentMethod === 'wise'.
  const [wiseProduct, setWiseProduct] = useState<ProductType | null>(null)
  const [wiseReference, setWiseReference] = useState<string | null>(null)
  const [wiseEmail, setWiseEmail] = useState('')
  const [wiseFile, setWiseFile] = useState<File | null>(null)
  const [wiseSubmitting, setWiseSubmitting] = useState(false)
  const [wiseError, setWiseError] = useState<string | null>(null)
  const [wiseDone, setWiseDone] = useState(false)

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

  const handleSelectWiseProduct = (productType: ProductType) => {
    setWiseProduct(productType)
    setWiseReference(generateWiseReference(productType))
    setWiseError(null)
  }

  const handleWiseSubmit = async () => {
    if (wiseSubmitting || !wiseProduct || !wiseEmail.trim() || !wiseFile) return
    setWiseSubmitting(true)
    setWiseError(null)
    const { error: submitError } = await submitManualPaymentProof({
      productType: wiseProduct,
      email: wiseEmail.trim(),
      file: wiseFile,
    })
    setWiseSubmitting(false)
    if (submitError) {
      setWiseError(submitError)
      return
    }
    setWiseDone(true)
  }

  const wiseProductInfo = wiseProduct ? PRODUCTS.find(p => p.type === wiseProduct) : null

  return (
    <div
      className="flex h-full w-full flex-col items-center gap-8 overflow-y-auto px-6 py-10 text-center"
      style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="text-2xl font-extrabold tracking-tight text-[var(--color-primary-dark)]">Bernafas</span>
        <span className="max-w-xs text-sm text-[var(--color-text-muted)]">"Ini Jantungmu — Dengarkan Dia Bercakap"</span>
      </div>

      {/* Method selector — "di sebelah ToyyibPay" per spec, not a separate
          page/route. Switching method resets any in-progress Wise
          sub-flow so a half-filled Wise form never lingers if the buyer
          bounces back to ToyyibPay. */}
      <div className="flex w-full max-w-xs gap-2 rounded-full bg-white/50 p-1">
        <button
          type="button"
          onClick={() => {
            setPaymentMethod('toyyibpay')
            setWiseProduct(null)
            setWiseDone(false)
          }}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
            paymentMethod === 'toyyibpay' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)]'
          }`}
        >
          ToyyibPay (Malaysia)
        </button>
        <button
          type="button"
          onClick={() => setPaymentMethod('wise')}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
            paymentMethod === 'wise' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)]'
          }`}
        >
          Wise (Antarabangsa)
        </button>
      </div>

      {error && <p className="max-w-xs text-sm text-[var(--color-warm)]">{error}</p>}
      {warning && <p className="max-w-xs text-sm text-[var(--color-text-muted)]">{warning}</p>}

      {paymentMethod === 'toyyibpay' && (
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
      )}

      {paymentMethod === 'wise' && !wiseProduct && (
        <div className="flex w-full max-w-xs flex-col gap-3">
          <p className="text-xs text-[var(--color-text-muted)]">Untuk pembeli di luar Malaysia. Pilih produk untuk teruskan.</p>
          {PRODUCTS.map(product => (
            <button
              key={product.type}
              type="button"
              onClick={() => handleSelectWiseProduct(product.type)}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-5 py-4 text-left transition-transform active:scale-[0.98]"
            >
              <span className="text-sm font-semibold text-[var(--color-text)]">{product.label}</span>
              <span className="text-base font-bold text-[var(--color-primary)]">RM{product.amount}</span>
            </button>
          ))}
        </div>
      )}

      {paymentMethod === 'wise' && wiseProduct && wiseDone && (
        <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl bg-white/70 p-5 text-center">
          <CheckCircle2 size={40} className="text-[var(--color-primary)]" />
          <p className="text-sm font-semibold text-[var(--color-text)]">Bukti bayaran diterima</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Akan disahkan dalam masa 24-48 jam. Kami akan hubungi anda di {wiseEmail}.
          </p>
        </div>
      )}

      {paymentMethod === 'wise' && wiseProduct && !wiseDone && wiseProduct !== WISE_SUPPORTED_PRODUCT && (
        <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl bg-white/70 p-5 text-center">
          <p className="text-sm font-semibold text-[var(--color-text)]">Wise belum tersedia untuk {wiseProductInfo?.label}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Buat masa ini Wise hanya tersedia untuk Buku "Ini Jantungmu". Sila guna ToyyibPay, atau pilih Buku di atas.
          </p>
          <button
            type="button"
            onClick={() => setWiseProduct(null)}
            className="text-xs text-[var(--color-text-muted)] underline-offset-4 hover:underline"
          >
            Pilih produk lain
          </button>
        </div>
      )}

      {paymentMethod === 'wise' && wiseProduct === WISE_SUPPORTED_PRODUCT && !wiseDone && (
        <div className="flex w-full max-w-xs flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-2xl bg-white/70 p-4 text-left">
            <span className="text-sm font-semibold text-[var(--color-text)]">
              {wiseProductInfo?.label} — RM{wiseProductInfo?.amount}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">Imbas kod QR ini dengan app Wise anda:</span>
            <img
              src={WISE_QR_IMAGE}
              alt="Kod QR pembayaran Wise"
              className="mx-auto h-48 w-48 rounded-xl border border-[var(--color-card-border)] bg-white object-contain"
            />
            <a
              href={WISE_LINK}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
            >
              Bayar melalui Wise <ExternalLink size={14} />
            </a>
            <span className="text-xs text-[var(--color-text-muted)]">
              Sertakan rujukan ini dalam nota pemindahan Wise anda supaya mudah disepadankan:
            </span>
            <div className="break-all rounded-xl bg-white/80 p-3 text-xs font-semibold text-[var(--color-primary-dark)]">
              {wiseReference}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {wiseError && <p className="text-sm text-[var(--color-warm)]">{wiseError}</p>}
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={wiseEmail}
              onChange={e => setWiseEmail(e.target.value)}
              placeholder="E-mel anda"
              className="w-full rounded-full border border-[var(--color-card-border)] bg-white/80 px-5 py-4 text-center text-base text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
            />
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-[var(--color-card-border)] bg-white/80 px-5 py-4 text-sm text-[var(--color-text-muted)]">
              <Upload size={16} />
              {wiseFile ? wiseFile.name : 'Muat naik screenshot bukti bayaran'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={e => setWiseFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              onClick={handleWiseSubmit}
              disabled={wiseSubmitting || !wiseEmail.trim() || !wiseFile}
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
            >
              {wiseSubmitting ? 'Menghantar...' : 'Hantar Bukti Bayaran'}
            </button>
            <button
              type="button"
              onClick={() => {
                setWiseProduct(null)
                setWiseFile(null)
                setWiseEmail('')
                setWiseError(null)
              }}
              className="text-xs text-[var(--color-text-muted)] underline-offset-4 hover:underline"
            >
              Pilih produk lain
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
