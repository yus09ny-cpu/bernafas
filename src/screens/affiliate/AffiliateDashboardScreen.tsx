import { useEffect, useState } from 'react'
import { Loader2, Download, MousePointerClick, CircleDollarSign, Share2 } from 'lucide-react'
import { fetchAffiliateDashboard, fetchAffiliateBookUrl, type AffiliateDashboardData } from '@/lib/affiliate'

interface AffiliateDashboardScreenProps {
  affiliateId: string
}

function formatRM(amount: number): string {
  return `RM${amount.toFixed(2)}`
}

// /affiliate/dashboard/:id — spec item 5, kept deliberately simple: click
// count + real sale counts (from `orders`, not affiliate_commissions — see
// api/affiliate/dashboard.ts's own comment on why), plus real commission
// RM totals now that the rate decision has landed (commissions.ts) — split
// by source (own sales vs. the 5% referral override from a downline) so
// an affiliate with referrals can see both income streams distinctly.
// `affiliateId` doubles as this screen's only access control (see
// dashboard.ts's comment on the gap that leaves) — no separate affiliate
// login exists yet.
export default function AffiliateDashboardScreen({ affiliateId }: AffiliateDashboardScreenProps) {
  const [data, setData] = useState<AffiliateDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAffiliateDashboard(affiliateId).then(({ data, error }) => {
      if (cancelled) return
      setData(data)
      setError(error)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [affiliateId])

  const handleDownload = async () => {
    if (!data || downloading) return
    setDownloading(true)
    setDownloadError(null)
    const { url, error } = await fetchAffiliateBookUrl(data.affiliate.username)
    setDownloading(false)
    if (error || !url) {
      setDownloadError(error ?? 'Gagal jana pautan muat turun.')
      return
    }
    // Signed URL from Supabase Storage — a plain navigation (not an
    // <a download>) since it's a cross-origin storage URL the browser
    // handles as a normal file download via its own Content-Disposition.
    window.location.href = url
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm text-[var(--color-warm)]">{error ?? 'Affiliate tidak dijumpai.'}</p>
      </div>
    )
  }

  const totalPending = data.commissions.sale.pending + data.commissions.referralOverride.pending
  const totalPaid = data.commissions.sale.paid + data.commissions.referralOverride.paid
  const inviteUrl = `${window.location.origin}/affiliate/daftar?ref=${data.affiliate.username}`

  return (
    <div
      className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto px-6 py-10 text-center"
      style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col gap-1">
        <span className="text-lg font-bold text-[var(--color-primary-dark)]">Selamat datang, {data.affiliate.name}</span>
        <span className="text-sm text-[var(--color-text-muted)]">bernafas.my/beli?ref={data.affiliate.username}</span>
      </div>

      <div className="flex w-full max-w-xs gap-3">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-white/70 px-4 py-5">
          <MousePointerClick size={20} className="text-[var(--color-accent)]" />
          <span className="text-2xl font-extrabold text-[var(--color-primary-dark)]">{data.clickCount}</span>
          <span className="text-xs text-[var(--color-text-muted)]">Klik</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl bg-white/70 px-4 py-5">
          <CircleDollarSign size={20} className="text-[var(--color-accent)]" />
          <span className="text-2xl font-extrabold text-[var(--color-primary-dark)]">{data.confirmedSales}</span>
          <span className="text-xs text-[var(--color-text-muted)]">Jualan Disahkan</span>
        </div>
      </div>

      {data.pendingSales > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">Menunggu pembayaran: {data.pendingSales}</p>
      )}

      <div className="flex w-full max-w-xs flex-col gap-2 rounded-2xl bg-white/70 p-4 text-left">
        <span className="text-sm font-semibold text-[var(--color-text)]">Komisen</span>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">Daripada jualan sendiri</span>
          <span className="font-medium text-[var(--color-text)]">
            {formatRM(data.commissions.sale.paid)} dibayar · {formatRM(data.commissions.sale.pending)} pending
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">Daripada rujukan</span>
          <span className="font-medium text-[var(--color-text)]">
            {formatRM(data.commissions.referralOverride.paid)} dibayar · {formatRM(data.commissions.referralOverride.pending)} pending
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-sm">
          <span className="font-semibold text-[var(--color-text)]">Jumlah</span>
          <span className="font-bold text-[var(--color-primary-dark)]">
            {formatRM(totalPaid)} dibayar · {formatRM(totalPending)} pending
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
      >
        <Download size={18} /> {downloading ? 'Menjana...' : 'Muat Turun Buku Saya'}
      </button>
      {downloadError && <p className="max-w-xs text-sm text-[var(--color-warm)]">{downloadError}</p>}

      <div className="flex w-full max-w-xs flex-col gap-2 rounded-2xl bg-white/60 p-4 text-left">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
          <Share2 size={16} /> Jemput Affiliate Lain
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          Dapat 5% tambahan daripada setiap jualan mereka, selagi mereka terus jual.
        </span>
        <div className="break-all rounded-xl bg-white/80 px-3 py-2 text-xs text-[var(--color-primary-dark)]">{inviteUrl}</div>
      </div>
    </div>
  )
}
