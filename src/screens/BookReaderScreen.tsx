import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, List, Loader2, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import AuthScreen from '@/screens/AuthScreen'
import { CHAPTERS, fetchChapter, type Chapter } from '@/lib/bookReader'

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; chapter: Chapter }
  | { status: 'not-purchased' }
  | { status: 'error'; message: string }

// /baca/:chapterNumber — the in-app full-book reader. A standalone route
// (wired in main.tsx's PublicRoot, same pattern as
// /admin/penghantaran -> AdminShippingScreen: own auth check via useAuth,
// deliberately NOT behind App.tsx's app-access (subscription/lifetime)
// gate). That gate would block a 'buku'-only buyer (no subscription, no
// pakej_lifetime) from ever reaching the book they paid for — see this
// feature's plan doc for the full reasoning.
//
// Replaces api/book/full.ts's PDF download entirely for the UI — no
// export/download control here by design, content is read in-app only,
// bab by bab, with api/book/chapter.ts gating chapter_number >= 3 per
// request (never a one-time signed URL that keeps working after access
// lapses).
export default function BookReaderScreen({ chapterNumber: initialChapterNumber }: { chapterNumber: number }) {
  const { status } = useAuth()
  const [chapterNumber, setChapterNumber] = useState(initialChapterNumber)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [showChapterList, setShowChapterList] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status !== 'signed-in') return
    let cancelled = false
    setState({ status: 'loading' })
    fetchChapter(chapterNumber).then(({ data, error, notPurchased }) => {
      if (cancelled) return
      if (notPurchased) {
        setState({ status: 'not-purchased' })
      } else if (error || !data) {
        setState({ status: 'error', message: error ?? 'Gagal muatkan bab.' })
      } else {
        setState({ status: 'loaded', chapter: data })
      }
      scrollRef.current?.scrollTo({ top: 0 })
    })
    return () => {
      cancelled = true
    }
  }, [status, chapterNumber])

  // Browser back/forward — /baca/N URLs are pushed by goToChapter below,
  // not full navigations, so this is what makes the browser's own
  // back/forward buttons work between chapters.
  useEffect(() => {
    const onPopState = () => {
      const match = window.location.pathname.match(/^\/baca\/(\d+)$/)
      if (match) setChapterNumber(Number(match[1]))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (status === 'loading') return null
  if (status !== 'signed-in') return <AuthScreen />

  const index = CHAPTERS.findIndex(c => c.number === chapterNumber)
  const prev = index > 0 ? CHAPTERS[index - 1] : null
  const next = index >= 0 && index < CHAPTERS.length - 1 ? CHAPTERS[index + 1] : null

  const goToChapter = (n: number) => {
    window.history.pushState(null, '', `/baca/${n}`)
    setChapterNumber(n)
    setShowChapterList(false)
  }

  return (
    <div className="flex h-dvh w-full flex-col bg-[var(--color-background)]">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 pb-8 pt-[calc(1.5rem+var(--safe-top))]">
          <div className="mb-4 flex items-center justify-between">
            <a href="/" className="text-xs font-semibold text-[var(--color-primary)]">
              ← Kembali
            </a>
            <button
              type="button"
              onClick={() => setShowChapterList(true)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--color-primary)]"
            >
              <List size={15} />
              Senarai Bab
            </button>
          </div>

          {state.status === 'loading' && (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
            </div>
          )}

          {state.status === 'error' && (
            <p className="text-sm text-[var(--color-warm)]">{state.message}</p>
          )}

          {state.status === 'not-purchased' && (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/70 px-5 py-8 text-center">
              <h1 className="text-base font-semibold text-[var(--color-text)]">Bab ini terkunci</h1>
              <p className="text-sm text-[var(--color-text-muted)]">Anda belum membeli buku penuh ini.</p>
              <a
                href="/beli"
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Lihat pilihan pembelian
              </a>
            </div>
          )}

          {state.status === 'loaded' && (
            <article>
              <h1 className="mb-6 text-xl font-bold text-[var(--color-text)]">{state.chapter.title}</h1>
              <div
                className="text-[15px] leading-relaxed text-[var(--color-text)] [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold [&_table]:mb-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:whitespace-nowrap [&_th]:border [&_th]:border-black/10 [&_th]:bg-black/5 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_td]:border [&_td]:border-black/10 [&_td]:px-2 [&_td]:py-1.5 [&_td]:whitespace-normal [&_img]:max-w-full"
                dangerouslySetInnerHTML={{ __html: state.chapter.contentHtml }}
              />
            </article>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-black/5 bg-[var(--color-background)] px-5 py-3 pb-[calc(0.75rem+var(--safe-bottom))]">
        <button
          type="button"
          onClick={() => prev && goToChapter(prev.number)}
          disabled={!prev}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-primary)] disabled:opacity-30"
        >
          <ChevronLeft size={16} />
          Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => next && goToChapter(next.number)}
          disabled={!next}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-primary)] disabled:opacity-30"
        >
          Seterusnya
          <ChevronRight size={16} />
        </button>
      </div>

      {showChapterList && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setShowChapterList(false)}>
          <div
            className="flex max-h-[80vh] flex-col rounded-t-2xl bg-[var(--color-background)] pb-[var(--safe-bottom)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Senarai Bab</h2>
              <button type="button" onClick={() => setShowChapterList(false)} aria-label="Tutup">
                <X size={18} className="text-[var(--color-text-muted)]" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              {CHAPTERS.map(c => {
                const isCurrent = c.number === chapterNumber
                return (
                  <button
                    key={c.number}
                    type="button"
                    onClick={() => goToChapter(c.number)}
                    className={`block w-full px-5 py-3 text-left text-sm ${
                      isCurrent
                        ? 'font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                        : 'text-[var(--color-text)]'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
