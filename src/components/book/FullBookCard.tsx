import { useState } from 'react'
import { Loader2, Download, BookOpen } from 'lucide-react'
import { fetchFullBookUrl } from '@/lib/book'

// "Muat Turun Buku Penuh Saya" — GuidesScreen's entry point into the
// purchase-gated full (13-bab) book (api/book/full.ts). Click-triggers the
// purchase check + download, same pattern as
// AffiliateDashboardScreen.tsx's handleDownload — deliberately NOT an
// on-mount auto-check, so opening the Panduan tab never silently fires a
// request before the user actually asks for the book.
export default function FullBookCard() {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notPurchased, setNotPurchased] = useState(false)

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    setError(null)
    setNotPurchased(false)
    const { url, error, notPurchased } = await fetchFullBookUrl()
    setDownloading(false)
    if (notPurchased) {
      setNotPurchased(true)
      return
    }
    if (error || !url) {
      setError(error ?? 'Gagal jana pautan muat turun.')
      return
    }
    window.location.href = url
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 px-5 py-5 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
        <BookOpen size={20} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-[var(--color-text)]">Buku "Ini Jantungmu" — Penuh</span>
        <span className="text-xs text-[var(--color-text-muted)]">13 bab lengkap, dalam format PDF</span>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {downloading ? 'Menjana...' : 'Muat Turun Buku Penuh Saya'}
      </button>

      {notPurchased && (
        <div className="flex flex-col items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <p>Anda belum membeli buku penuh ini.</p>
          <a
            href="/beli"
            className="font-semibold text-[var(--color-primary)] underline underline-offset-2"
          >
            Lihat pilihan pembelian
          </a>
        </div>
      )}
      {error && <p className="text-xs text-[var(--color-warm)]">{error}</p>}
    </div>
  )
}
