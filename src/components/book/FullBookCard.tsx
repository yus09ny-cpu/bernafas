import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fetchReadingProgress } from '@/lib/bookReader'

// "Baca Buku Penuh" / "Sambung Membaca" — GuidesScreen's entry point into
// the in-app reader (/baca/:chapterNumber -> BookReaderScreen). Used to be
// "Muat Turun Buku Penuh Saya" (a signed-URL PDF download via
// api/book/full.ts) — replaced entirely so the full book can't be
// redistributed as a file once downloaded; api/book/full.ts itself is
// kept but no longer called from anywhere in the UI.
//
// No pre-navigation purchase check here (unlike the old handleDownload) —
// Bab 0-2 are free for any signed-in user with no access check at all
// (api/book/chapter.ts), so this button can always navigate straight to
// chapter 0/last-read. The paywall (Bab 3+) is handled inside the reader
// itself, per chapter, not here.
export default function FullBookCard() {
  const { session } = useAuth()
  const [lastReadChapter, setLastReadChapter] = useState<number | null>(null)

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return
    let cancelled = false
    fetchReadingProgress(userId).then(chapter => {
      if (!cancelled) setLastReadChapter(chapter)
    })
    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  const resuming = lastReadChapter !== null

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 px-5 py-5 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
        <BookOpen size={20} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-[var(--color-text)]">Buku "Ini Jantungmu" — Penuh</span>
        <span className="text-xs text-[var(--color-text-muted)]">13 bab lengkap, baca dalam app</span>
      </div>

      <button
        type="button"
        onClick={() => {
          window.location.href = `/baca/${resuming ? lastReadChapter : 0}`
        }}
        className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
      >
        <BookOpen size={16} />
        {resuming ? 'Sambung Membaca' : 'Baca Buku Penuh'}
      </button>
    </div>
  )
}
