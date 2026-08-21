import { useEffect, useState } from 'react'
import { Loader2, ImageIcon, Check, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import AuthScreen from '@/screens/AuthScreen'
import {
  fetchManualPaymentProofs,
  approveManualPaymentProof,
  rejectManualPaymentProof,
  type ManualPaymentProof,
} from '@/lib/manualPayment'

function ProofRow({ proof, onReviewed }: { proof: ManualPaymentProof; onReviewed: () => void }) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    if (busy) return
    setBusy('approve')
    setError(null)
    const { error: approveError } = await approveManualPaymentProof(proof.id)
    setBusy(null)
    if (approveError) {
      setError(approveError)
      return
    }
    onReviewed()
  }

  const handleReject = async () => {
    if (busy) return
    setBusy('reject')
    setError(null)
    const { error: rejectError } = await rejectManualPaymentProof(proof.id)
    setBusy(null)
    if (rejectError) {
      setError(rejectError)
      return
    }
    onReviewed()
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[var(--color-text)]">{proof.orders?.product_type ?? '—'}</span>
        <span className="text-xs text-[var(--color-text-muted)]">RM{proof.orders?.amount ?? '—'}</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">{proof.submitted_email}</p>
      <p className="text-[11px] text-[var(--color-text-muted)]">{new Date(proof.created_at).toLocaleString('ms-MY')}</p>

      {proof.imageUrl ? (
        <a href={proof.imageUrl} target="_blank" rel="noreferrer">
          <img src={proof.imageUrl} alt="Bukti bayaran" className="max-h-64 w-full rounded-xl object-contain" />
        </a>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-xl bg-white/50 text-[var(--color-text-muted)]">
          <ImageIcon size={24} />
        </div>
      )}

      {error && <p className="text-xs text-[var(--color-warm)]">{error}</p>}

      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy !== null}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Sahkan
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={busy !== null}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-[var(--color-warm)] disabled:opacity-50"
        >
          {busy === 'reject' ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
          Tolak
        </button>
      </div>
    </div>
  )
}

// /admin/bayaran-manual — reviews "Wise (Antarabangsa)" manual payment
// proofs (BeliLandingScreen.tsx's Wise flow, api/checkout/manual-payment.ts).
// Same reachability pattern as AdminShippingScreen.tsx — outside App.tsx's
// auth+app-access gate, own useAuth check, own role check via the API's
// hasAdminRole(user, 'admin') guard (any of the 3 tiers — see
// supabase/migrations/0007_admin_roles.sql). "Sahkan" calls the SAME
// markOrderPaid logic ToyyibPay's real webhook uses (server-side, this
// screen never re-implements that) — see api/_lib/markOrderPaid.ts.
export default function AdminManualPaymentScreen() {
  const { status } = useAuth()
  const [proofs, setProofs] = useState<ManualPaymentProof[] | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    fetchManualPaymentProofs().then(({ proofs, forbidden, error }) => {
      if (forbidden) {
        setForbidden(true)
        return
      }
      if (error) {
        setError(error)
        return
      }
      setProofs(proofs)
    })
  }

  useEffect(() => {
    if (status === 'signed-in') load()
  }, [status])

  if (status === 'loading') return null
  if (status !== 'signed-in') return <AuthScreen />
  if (forbidden) {
    return (
      <div className="flex h-dvh w-full items-center justify-center px-8 text-center">
        <p className="text-sm text-[var(--color-warm)]">Tiada akses.</p>
      </div>
    )
  }

  return (
    <div className="h-dvh w-full overflow-y-auto bg-[var(--color-bg)] px-5 py-6" style={{ paddingTop: 'calc(1.5rem + var(--safe-top))' }}>
      <h1 className="mb-4 text-lg font-bold text-[var(--color-primary-dark)]">Bayaran Manual (Wise)</h1>

      {error && <p className="text-sm text-[var(--color-warm)]">{error}</p>}
      {proofs === null && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {proofs && (
        <div className="flex flex-col gap-3">
          {proofs.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">Tiada bukti bayaran menunggu semakan.</p>}
          {proofs.map(p => <ProofRow key={p.id} proof={p} onReviewed={load} />)}
        </div>
      )}
    </div>
  )
}
