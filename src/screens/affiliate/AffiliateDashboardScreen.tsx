import { useEffect, useState } from 'react'
import { Loader2, Download, MousePointerClick, CircleDollarSign, Share2, Wallet, ExternalLink, BookOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  fetchAffiliateDashboard,
  fetchAffiliateBookUrl,
  fetchAffiliateMe,
  updateAffiliateWiseEmail,
  type AffiliateDashboardData,
  type AffiliateSelf,
} from '@/lib/affiliate'

// The product owner's own Wise referral invite link — shown to every
// affiliate so they sign up for Wise through it if they don't already have
// an account. Static/global (not per-affiliate), so a plain constant is
// enough — no config file needed for a single use site.
const WISE_INVITE_URL = 'https://wise.com/invite/ahpc/mohdb1212'

interface AffiliateDashboardScreenProps {
  affiliateId: string
}

function formatRM(amount: number): string {
  return `RM${amount.toFixed(2)}`
}

// "Terima Bayaran Melalui Wise" — spec's payout-details section. Always
// shows the invite link (harmless, public, no auth needed), but the actual
// e-mel form only renders once we've confirmed (via a real signed-in
// session, see the parent's `self` state) that the viewer IS this exact
// affiliate — never based on knowing this page's URL/affiliateId alone.
// Someone viewing via a bare capability-link with no session, or signed in
// as a DIFFERENT affiliate, gets a prompt to log in instead — they can
// never see or overwrite this affiliate's payout e-mel.
function WiseSection({
  self,
  selfChecked,
  accessToken,
  affiliateId,
}: {
  self: AffiliateSelf | null
  selfChecked: boolean
  accessToken: string | null
  affiliateId: string
}) {
  const [email, setEmail] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const matchedSelf = self && self.id === affiliateId ? self : null

  useEffect(() => {
    if (matchedSelf && !initialized) {
      setEmail(matchedSelf.wise_email ?? '')
      setInitialized(true)
    }
  }, [matchedSelf, initialized])

  const handleSave = async () => {
    if (!accessToken || saving) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    const { success, error } = await updateAffiliateWiseEmail(accessToken, email.trim())
    setSaving(false)
    if (!success) {
      setSaveError(error ?? 'Gagal simpan.')
      return
    }
    setSaved(true)
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-3 rounded-2xl bg-white/70 p-4 text-left">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
        <Wallet size={16} /> Terima Bayaran Melalui Wise
      </span>

      <a
        href={WISE_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-[var(--color-primary)] underline-offset-4 hover:underline"
      >
        Belum ada akaun Wise? Daftar di sini dulu <ExternalLink size={12} />
      </a>

      {!selfChecked && <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />}

      {selfChecked && !matchedSelf && (
        <p className="text-xs text-[var(--color-text-muted)]">
          <a href="/affiliate/log-masuk" className="underline">Log masuk</a> sebagai affiliate ini untuk urus e-mel akaun Wise anda.
        </p>
      )}

      {selfChecked && matchedSelf && (
        <div className="flex flex-col gap-2">
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              setSaved(false)
            }}
            placeholder="emel@akaunwise.com"
            className="w-full rounded-lg border border-[var(--color-card-border)] bg-white/80 px-3 py-2 text-xs outline-none focus:border-[var(--color-primary)]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : 'Simpan Emel Akaun Wise'}
          </button>
          {saveError && <p className="text-xs text-[var(--color-warm)]">{saveError}</p>}
          {saved && <p className="text-xs text-[var(--color-primary-dark)]">Disimpan.</p>}
        </div>
      )}
    </div>
  )
}

// UI-only content card — no logic/schema change, just tells affiliates the
// two ways people can end up with the personalized PDF and still trigger a
// commission (the referral link baked into the PDF is what actually tracks
// the sale, not the delivery channel). Tabbed rather than both-open so the
// card stays short next to the download button it sits below.
function ShareGuideSection() {
  const [tab, setTab] = useState<'terus' | 'drive'>('terus')

  const tabButtonClass = (active: boolean) =>
    `flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      active ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)]'
    }`

  return (
    <div className="flex w-full max-w-xs flex-col gap-3 rounded-2xl bg-white/60 p-4 text-left">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
        <BookOpen size={16} /> Cara Kongsi Buku Anda
      </span>

      <div className="flex gap-1 rounded-full bg-white/70 p-1">
        <button type="button" onClick={() => setTab('terus')} className={tabButtonClass(tab === 'terus')}>
          Cara 1: Hantar Terus
        </button>
        <button type="button" onClick={() => setTab('drive')} className={tabButtonClass(tab === 'drive')}>
          Cara 2: Google Drive
        </button>
      </div>

      {tab === 'terus' ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--color-text)]">Paling pantas</span>
          <ol className="flex flex-col gap-1 pl-4 text-xs text-[var(--color-text-muted)]" style={{ listStyleType: 'decimal' }}>
            <li>Muat turun buku diperibadikan anda (guna butang di atas)</li>
            <li>Hantar fail PDF tu terus kepada rakan-rakan melalui WhatsApp, Telegram, atau emel — senang dan pantas</li>
          </ol>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--color-text)]">Untuk kongsi lebih luas</span>
          <ol className="flex flex-col gap-1 pl-4 text-xs text-[var(--color-text-muted)]" style={{ listStyleType: 'decimal' }}>
            <li>Muat turun buku diperibadikan anda</li>
            <li>Simpan fail tu ke Google Drive anda sendiri</li>
            <li>Dapatkan pautan kongsi (share link) daripada Google Drive</li>
            <li>
              Pendekkan pautan tu dan jana QR code sekali guna di{' '}
              <a
                href="https://qrlink.bernafas.my"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[var(--color-primary)] underline-offset-4 hover:underline"
              >
                qrlink.bernafas.my <ExternalLink size={10} />
              </a>
            </li>
            <li>Kongsi pautan/QR dengan rakan-rakan anda — senang untuk siar di media sosial atau poster fizikal</li>
          </ol>
        </div>
      )}

      <p className="border-t border-[var(--color-border)] pt-2 text-[11px] text-[var(--color-text-muted)]">
        Ini maklumat <span className="font-semibold text-[var(--color-text)]">PERCUMA</span> — galakkan rakan-rakan anda
        baca dan ketahui lebih lanjut. Setiap kali seseorang klik pautan pembelian di dalam buku dan beli, anda dapat
        komisen — tak kira cara mana mereka terima buku tu (terus, Google Drive, atau QR code).
      </p>
    </div>
  )
}

// /affiliate/dashboard/:id — spec item 5, kept deliberately simple: click
// count + real sale counts (from `orders`, not affiliate_commissions — see
// api/affiliate/dashboard.ts's own comment on why), plus real commission
// RM totals now that the rate decision has landed (commissions.ts) — split
// by source (own sales vs. the 5% referral override from a downline) so
// an affiliate with referrals can see both income streams distinctly.
// `affiliateId` doubles as this screen's only access control for the
// aggregate counts below — affiliate login (0008_affiliate_auth.sql) now
// exists, but reaching this screen still doesn't require it (a bookmarked
// dashboard link keeps working). The Wise-payout section further down is
// stricter: it only reads/writes via a real signed-in session (see its own
// comment), never via this `affiliateId` alone — a real Supabase Auth
// session tied to `wise_email`'s access model matters more than every other
// field on this screen.
export default function AffiliateDashboardScreen({ affiliateId }: AffiliateDashboardScreenProps) {
  const [data, setData] = useState<AffiliateDashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  // Signed-in affiliate (if any) — resolved independently of `affiliateId`.
  // `self` only ever comes from a verified Supabase Auth session
  // (fetchAffiliateMe), never from the URL, so it can only ever be the
  // actual caller's own account.
  const [self, setSelf] = useState<AffiliateSelf | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [selfChecked, setSelfChecked] = useState(false)

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

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      const token = sessionData.session?.access_token
      if (!token) {
        if (!cancelled) setSelfChecked(true)
        return
      }
      const { data: affiliate } = await fetchAffiliateMe(token)
      if (cancelled) return
      setAccessToken(token)
      setSelf(affiliate)
      setSelfChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

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
            {formatRM(data.commissions.sale.pending)} belum dibayar · {formatRM(data.commissions.sale.paid)} dah dibayar
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">Daripada rujukan</span>
          <span className="font-medium text-[var(--color-text)]">
            {formatRM(data.commissions.referralOverride.pending)} belum dibayar · {formatRM(data.commissions.referralOverride.paid)} dah dibayar
          </span>
        </div>
        <div className="mt-1 flex flex-col gap-1 border-t border-[var(--color-border)] pt-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--color-text)]">Belum Dibayar</span>
            <span className="font-bold text-[var(--color-warm)]">{formatRM(totalPending)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--color-text)]">Dah Dibayar</span>
            <span className="font-bold text-[var(--color-primary-dark)]">{formatRM(totalPaid)}</span>
          </div>
        </div>
      </div>

      <WiseSection self={self} selfChecked={selfChecked} accessToken={accessToken} affiliateId={affiliateId} />

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="flex w-full max-w-xs items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
      >
        <Download size={18} /> {downloading ? 'Menjana...' : 'Muat Turun Buku Saya'}
      </button>
      {downloadError && <p className="max-w-xs text-sm text-[var(--color-warm)]">{downloadError}</p>}

      <ShareGuideSection />

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
