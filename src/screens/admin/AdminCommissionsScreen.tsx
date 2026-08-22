import { useEffect, useState } from 'react'
import { ArrowLeft, Banknote, CheckCircle2, Loader2, Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import AuthScreen from '@/screens/AuthScreen'

interface PendingAffiliate {
  username: string
  name: string
  pendingTotal: number
}

interface CommissionRow {
  id: string
  order_id: string
  amount: number
  status: 'pending' | 'paid'
  commission_type: 'sale' | 'referral_override' | null
  created_at: string
  paid_at: string | null
  orders: { created_at: string; amount: number; product_type: string } | null
}

interface AffiliateDetail {
  username: string
  name: string
  wise_email: string | null
}

function formatRM(amount: number): string {
  return `RM${amount.toFixed(2)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Detail + mark-paid view for one affiliate (spec items 2-3). Individual
// row checkboxes + a "pilih semua" checkbox share ONE "Tandakan Dibayar"
// button (posting the selected ids) — covers "baris individu ATAU semua
// sekaligus" without needing two separate flows/buttons.
function AffiliateDetailView({ username, onBack }: { username: string; onBack: () => void }) {
  const [affiliate, setAffiliate] = useState<AffiliateDetail | null>(null)
  const [commissions, setCommissions] = useState<CommissionRow[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    authHeader().then(headers => {
      fetch(`/api/admin/commissions?username=${encodeURIComponent(username)}`, { headers }).then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          setError(data.error ?? 'Gagal muatkan butiran.')
          return
        }
        setAffiliate(data.affiliate)
        setCommissions(data.commissions ?? [])
        setSelected(new Set())
      })
    })
  }

  useEffect(load, [username])

  const pendingRows = commissions?.filter(c => c.status === 'pending') ?? []
  const allPendingSelected = pendingRows.length > 0 && pendingRows.every(c => selected.has(c.id))

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allPendingSelected ? new Set() : new Set(pendingRows.map(c => c.id)))
  }

  const handleMarkPaid = async () => {
    if (selected.size === 0 || saving) return
    setSaving(true)
    setError(null)
    const response = await fetch('/api/admin/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ ids: [...selected] }),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) {
      setError(data.error ?? 'Gagal tandakan dibayar.')
      return
    }
    load()
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-xs font-medium text-[var(--color-text-muted)]"
      >
        <ArrowLeft size={14} /> Kembali ke senarai
      </button>

      {error && <p className="text-sm text-[var(--color-warm)]">{error}</p>}

      {!affiliate && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {affiliate && (
        <>
          <div className="flex flex-col gap-1 rounded-2xl bg-white/70 p-4">
            <span className="text-base font-bold text-[var(--color-primary-dark)]">{affiliate.name}</span>
            <span className="text-xs text-[var(--color-text-muted)]">@{affiliate.username}</span>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Wallet size={14} className="text-[var(--color-accent)]" />
              {affiliate.wise_email ? (
                <span className="font-medium text-[var(--color-text)]">{affiliate.wise_email}</span>
              ) : (
                <span className="text-[var(--color-warm)]">Belum diisi oleh affiliate</span>
              )}
            </div>
          </div>

          {pendingRows.length > 0 && (
            <div className="flex items-center justify-between rounded-2xl bg-white/70 p-3">
              <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-text)]">
                <input type="checkbox" checked={allPendingSelected} onChange={toggleAll} />
                Pilih semua pending ({pendingRows.length})
              </label>
              <button
                type="button"
                onClick={handleMarkPaid}
                disabled={selected.size === 0 || saving}
                className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Tandakan Dibayar ({selected.size})
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {(commissions ?? []).map(row => (
              <div key={row.id} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 text-sm">
                {row.status === 'pending' ? (
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} />
                ) : (
                  <CheckCircle2 size={16} className="shrink-0 text-[var(--color-primary)]" />
                )}
                <div className="flex flex-1 flex-col">
                  <span className="font-medium text-[var(--color-text)]">
                    {row.orders?.product_type ?? '—'} · {row.commission_type === 'referral_override' ? 'Rujukan' : 'Jualan'}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {formatDate(row.created_at)}
                    {row.status === 'paid' && row.paid_at ? ` · dibayar ${formatDate(row.paid_at)}` : ''}
                  </span>
                </div>
                <span className="font-bold text-[var(--color-primary-dark)]">{formatRM(row.amount)}</span>
              </div>
            ))}
            {commissions?.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">Tiada rekod komisen.</p>}
          </div>
        </>
      )}
    </div>
  )
}

// /admin/komisen — spec's admin screen: which affiliates have outstanding
// pending commissions (highest first), drill into one to see their Wise
// e-mel + full row history, mark rows paid. Reached the same way as
// AdminShippingScreen.tsx/AdminManagementScreen.tsx (main.tsx's PublicRoot,
// outside App.tsx's gate) — own useAuth check, own role check via
// api/admin/commissions.ts's hasAdminRole(user, 'super') guard (one tier
// above shipping's 'admin' floor — see that file's own header).
export default function AdminCommissionsScreen() {
  const { status } = useAuth()
  const [affiliates, setAffiliates] = useState<PendingAffiliate[] | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null)

  const load = () => {
    authHeader().then(headers => {
      fetch('/api/admin/commissions', { headers }).then(async response => {
        const data = await response.json().catch(() => ({}))
        if (response.status === 403) {
          setForbidden(true)
          return
        }
        if (!response.ok) {
          setError(data.error ?? 'Gagal muatkan senarai komisen.')
          return
        }
        setAffiliates(data.affiliates ?? [])
      })
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
      <h1 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--color-primary-dark)]">
        <Banknote size={20} /> Komisen Affiliate
      </h1>

      {error && <p className="mb-3 text-sm text-[var(--color-warm)]">{error}</p>}

      {selectedUsername ? (
        <AffiliateDetailView username={selectedUsername} onBack={() => { setSelectedUsername(null); load() }} />
      ) : (
        <>
          {affiliates === null && !error && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
            </div>
          )}

          {affiliates && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                Pending Tertunggak ({affiliates.length})
              </h2>
              {affiliates.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)]">Tiada komisen pending — semua affiliate sudah dibayar.</p>
              )}
              {affiliates.map(a => (
                <button
                  key={a.username}
                  type="button"
                  onClick={() => setSelectedUsername(a.username)}
                  className="flex items-center justify-between rounded-2xl bg-white/70 p-4 text-left text-sm transition-transform active:scale-[0.98]"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-[var(--color-text)]">{a.name}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">@{a.username}</span>
                  </div>
                  <span className="font-bold text-[var(--color-warm)]">{formatRM(a.pendingTotal)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
