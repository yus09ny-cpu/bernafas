import { useEffect, useState } from 'react'
import { Loader2, Package, Truck, X } from 'lucide-react'
import { fetchMyShippingOrders, saveShippingAddress, type MyShippingOrder } from '@/lib/shipping'

interface ShippingScreenProps {
  onClose: () => void
  // Set by PaymentSuccessScreen.tsx (billReturnUrl's /beli/selesai) — shows
  // a congratulatory banner above the order list, since that's the moment
  // spec item 1 actually means ("selepas pembayaran berjaya... papar
  // borang"). AccountMenu.tsx's own "Penghantaran Sensor" entry point
  // renders this same component without the banner — that's a
  // status-check visit, not a just-paid moment.
  successBanner?: boolean
}

// Malaysia's 13 states + 3 federal territories — plain <select>, no need
// for a picker library for a fixed 16-item list.
const MALAYSIA_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang',
  'Pulau Pinang', 'Perak', 'Perlis', 'Selangor', 'Terengganu', 'Sabah',
  'Sarawak', 'W.P. Kuala Lumpur', 'W.P. Labuan', 'W.P. Putrajaya',
]

const PRODUCT_LABELS: Record<string, string> = {
  sensor: 'Sensor Sahaja',
  pakej_lifetime: 'Pakej Buku + Sensor + Aplikasi (Lifetime)',
}

function AddressForm({ orderId, onSaved }: { orderId: string; onSaved: () => void }) {
  const [recipientName, setRecipientName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [state, setState] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    const { success, error } = await saveShippingAddress({ orderId, recipientName, phone, address, postcode, state })
    setSaving(false)
    if (!success) {
      setError(error ?? 'Gagal simpan alamat.')
      return
    }
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 rounded-2xl bg-white/70 p-4">
      <p className="text-xs font-medium text-[var(--color-primary-dark)]">Isi alamat penghantaran</p>
      <input
        required
        value={recipientName}
        onChange={e => setRecipientName(e.target.value)}
        placeholder="Nama penerima"
        className="w-full rounded-xl border border-[var(--color-card-border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
      />
      <input
        required
        type="tel"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        placeholder="No. telefon"
        className="w-full rounded-xl border border-[var(--color-card-border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
      />
      <textarea
        required
        value={address}
        onChange={e => setAddress(e.target.value)}
        placeholder="Alamat penuh"
        rows={3}
        className="w-full resize-none rounded-xl border border-[var(--color-card-border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
      />
      <div className="flex gap-2">
        <input
          required
          inputMode="numeric"
          value={postcode}
          onChange={e => setPostcode(e.target.value)}
          placeholder="Poskod"
          className="w-28 rounded-xl border border-[var(--color-card-border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        />
        <select
          required
          value={state}
          onChange={e => setState(e.target.value)}
          className="flex-1 rounded-xl border border-[var(--color-card-border)] bg-white/80 px-4 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
        >
          <option value="" disabled>Negeri</option>
          {MALAYSIA_STATES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-[var(--color-warm)]">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : 'Simpan Alamat'}
      </button>
    </form>
  )
}

function OrderCard({ order, onSaved }: { order: MyShippingOrder; onSaved: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--color-text)]">
          {PRODUCT_LABELS[order.productType] ?? order.productType}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">RM{order.amount}</span>
      </div>

      {!order.shippingSubmitted && <AddressForm orderId={order.orderId} onSaved={onSaved} />}

      {order.shippingSubmitted && order.shippingStatus === 'belum_hantar' && (
        <div className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-[var(--color-text-muted)]">
          <Package size={14} /> Belum Dihantar — alamat sudah diterima
        </div>
      )}
      {order.shippingSubmitted && order.shippingStatus === 'dihantar' && (
        <div className="flex flex-col gap-1 rounded-xl bg-[var(--color-primary)]/10 px-3 py-2 text-xs text-[var(--color-primary-dark)]">
          <span className="flex items-center gap-2 font-medium"><Truck size={14} /> Dihantar</span>
          {order.trackingNumber && <span>No. penjejakan: {order.trackingNumber}</span>}
        </div>
      )}
    </div>
  )
}

// Overlay (not a PublicRoot route) triggered from AccountMenu.tsx — every
// 'sensor'/'pakej_lifetime' paid order this user has, each showing either
// the one-time address form or its current shipping status. Empty state
// (no eligible orders) still renders, with a short explanatory line rather
// than nothing — a user without a physical-sensor purchase clicking this
// by curiosity shouldn't see a blank screen with no context.
export default function ShippingScreen({ onClose, successBanner }: ShippingScreenProps) {
  const [orders, setOrders] = useState<MyShippingOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    fetchMyShippingOrders().then(({ orders, error }) => {
      setOrders(orders)
      setError(error)
    })
  }

  useEffect(load, [])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-[var(--color-bg)]">
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ paddingTop: 'calc(1rem + var(--safe-top))' }}
      >
        <span className="text-base font-bold text-[var(--color-primary-dark)]">Penghantaran Sensor</span>
        <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-full bg-white/70 p-2 text-[var(--color-text-muted)]">
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-8">
        {successBanner && (
          <div className="rounded-2xl bg-[var(--color-primary)]/10 px-4 py-3 text-sm font-medium text-[var(--color-primary-dark)]">
            Pembayaran berjaya! Lengkapkan alamat penghantaran di bawah supaya sensor anda boleh dihantar.
          </div>
        )}
        {orders === null && !error && (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
          </div>
        )}
        {error && <p className="text-sm text-[var(--color-warm)]">{error}</p>}
        {orders && orders.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Tiada pesanan sensor/pakej lifetime dijumpai untuk akaun ini.
          </p>
        )}
        {orders?.map(order => (
          <OrderCard key={order.orderId} order={order} onSaved={load} />
        ))}
      </div>
    </div>
  )
}
