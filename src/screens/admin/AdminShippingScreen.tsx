import { useEffect, useState } from 'react'
import { Loader2, Package, Truck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import AuthScreen from '@/screens/AuthScreen'

interface Shipment {
  id: string
  order_id: string
  recipient_name: string
  phone: string
  address: string
  postcode: string
  state: string
  shipping_status: 'belum_hantar' | 'dihantar'
  tracking_number: string | null
  created_at: string
  orders: { product_type: string; amount: number; email: string | null } | null
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function ShipmentRow({ shipment, onUpdated }: { shipment: Shipment; onUpdated: () => void }) {
  const [tracking, setTracking] = useState(shipment.tracking_number ?? '')
  const [saving, setSaving] = useState(false)

  const handleMarkShipped = async () => {
    if (saving) return
    setSaving(true)
    await fetch('/api/admin/shipping-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify({ shippingId: shipment.id, trackingNumber: tracking }),
    })
    setSaving(false)
    onUpdated()
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[var(--color-text)]">{shipment.recipient_name}</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {shipment.orders?.product_type} · RM{shipment.orders?.amount}
        </span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">{shipment.orders?.email}</p>
      <p className="text-xs">{shipment.phone}</p>
      <p className="text-xs">{shipment.address}, {shipment.postcode} {shipment.state}</p>

      {shipment.shipping_status === 'belum_hantar' ? (
        <div className="mt-1 flex gap-2">
          <input
            value={tracking}
            onChange={e => setTracking(e.target.value)}
            placeholder="No. penjejakan (opsyenal)"
            className="flex-1 rounded-lg border border-[var(--color-card-border)] bg-white/80 px-3 py-2 text-xs outline-none focus:border-[var(--color-primary)]"
          />
          <button
            type="button"
            onClick={handleMarkShipped}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />}
            Tandakan Dihantar
          </button>
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-2 rounded-lg bg-[var(--color-primary)]/10 px-3 py-2 text-xs font-medium text-[var(--color-primary-dark)]">
          <Truck size={12} /> Dihantar{shipment.tracking_number ? ` — ${shipment.tracking_number}` : ''}
        </div>
      )}
    </div>
  )
}

// /admin/penghantaran — admin-only order-fulfillment list, reached via
// main.tsx's PublicRoot (outside App.tsx's auth+app-access gate
// deliberately: the product owner must reach this regardless of their own
// subscription/order state, which App.tsx's gate has nothing to do with
// anyway — this screen does its OWN auth check via useAuth, then its own
// admin check via the api/admin/*.ts routes' isAdmin server-side guard).
export default function AdminShippingScreen() {
  const { status } = useAuth()
  const [shipments, setShipments] = useState<Shipment[] | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    authHeader().then(headers => {
      fetch('/api/admin/shipping-list', { headers }).then(async response => {
        const data = await response.json().catch(() => ({}))
        if (response.status === 403) {
          setForbidden(true)
          return
        }
        if (!response.ok) {
          setError(data.error ?? 'Gagal muatkan senarai.')
          return
        }
        setShipments(data.shipments ?? [])
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

  const pending = shipments?.filter(s => s.shipping_status === 'belum_hantar') ?? []
  const shipped = shipments?.filter(s => s.shipping_status === 'dihantar') ?? []

  return (
    <div className="h-dvh w-full overflow-y-auto bg-[var(--color-bg)] px-5 py-6" style={{ paddingTop: 'calc(1.5rem + var(--safe-top))' }}>
      <h1 className="mb-4 text-lg font-bold text-[var(--color-primary-dark)]">Penghantaran</h1>

      {error && <p className="text-sm text-[var(--color-warm)]">{error}</p>}
      {shipments === null && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {shipments && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <Package size={16} /> Belum Dihantar ({pending.length})
            </h2>
            {pending.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">Tiada order menunggu.</p>}
            {pending.map(s => <ShipmentRow key={s.id} shipment={s} onUpdated={load} />)}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <Truck size={16} /> Dihantar ({shipped.length})
            </h2>
            {shipped.map(s => <ShipmentRow key={s.id} shipment={s} onUpdated={load} />)}
          </section>
        </div>
      )}
    </div>
  )
}
