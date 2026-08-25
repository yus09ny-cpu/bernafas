import { supabase } from '@/lib/supabase'

// Static chapter order/labels for the reader's Bab Seterusnya/Sebelumnya
// nav — matches book_chapters exactly (populated by
// scripts/parse-book-chapters.mjs, since deleted). Kept here rather than
// fetched from the API so the nav can render immediately without an extra
// "list chapters" round trip.
export const CHAPTERS: { number: number; label: string }[] = [
  { number: 0, label: 'Pengenalan' },
  { number: 1, label: 'Bab 1: Surat dari Jantungmu' },
  { number: 2, label: 'Bab 2: Dunia yang Berlari Terlalu Pantas' },
  { number: 3, label: 'Bab 3: Jantung Bukan Sekadar Pam' },
  { number: 4, label: 'Bab 4: Koheren – Apabila Segalanya Selari' },
  { number: 5, label: 'Bab 5: HRV – Bahasa Rahsia Jantungmu' },
  { number: 6, label: 'Bab 6: Medan Elektromagnetik – Kita Saling Berhubungan' },
  { number: 7, label: 'Bab 7: Nafas Jantung (Teknik Asas)' },
  { number: 8, label: 'Bab 8: Koheren Pantas (Reset 3 Minit)' },
  { number: 9, label: 'Bab 9: Nafas Sikap (Ubah Cuaca Dalamanmu)' },
  { number: 10, label: 'Bab 10: Beku & Tanya (Freeze Frame)' },
  { number: 11, label: 'Bab 11: Kunci Hati (Memancar ke Luar)' },
  { number: 12, label: 'Bab 12: Cara Hidup Berasaskan Hati' },
  { number: 13, label: 'Bab 13: Rancangan Latihan 40 Hari' },
  { number: 99, label: 'Lampiran' },
]

export interface Chapter {
  chapterNumber: number
  title: string
  contentHtml: string
}

export interface FetchChapterResult {
  data: Chapter | null
  error: string | null
  notPurchased: boolean
}

// Client-side helper for api/book/chapter.ts — corak sama macam
// fetchFullBookUrl (src/lib/book.ts, kini digantikan sepenuhnya oleh
// reader ini) tapi mengembalikan kandungan bab terus, bukan pautan
// muat turun.
export async function fetchChapter(chapterNumber: number): Promise<FetchChapterResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { data: null, error: 'Sila log masuk dahulu.', notPurchased: false }

  const response = await fetch(`/api/book/chapter?chapter_number=${chapterNumber}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      data: null,
      error: body.error ?? 'Gagal muatkan bab.',
      notPurchased: body.code === 'NOT_PURCHASED',
    }
  }
  return { data: { chapterNumber: body.chapterNumber, title: body.title, contentHtml: body.contentHtml }, error: null, notPurchased: false }
}

// "Sambung Membaca" — profiles.last_read_chapter/last_read_at
// (supabase/migrations/0012_reading_progress.sql). Direct client-side
// reads/writes via RLS's "select own"/"update own" policies, same
// established pattern as src/lib/program40/enrollment.ts's own direct
// .update() calls — no api/ route needed for a single-row, owner-scoped
// value like this.

// FullBookCard's mount-time check — null (not an error) means the user
// has never opened the reader before, so the button stays "Baca Buku
// Penuh" -> /baca/0 instead of "Sambung Membaca".
export async function fetchReadingProgress(userId: string): Promise<number | null> {
  const { data, error } = await supabase.from('profiles').select('last_read_chapter').eq('id', userId).maybeSingle()
  if (error || !data) return null
  return data.last_read_chapter
}

// BookReaderScreen calls this on every successful chapter load (not on a
// paywall/error state — only a chapter the user actually got to read
// counts as "read"). Deliberately fire-and-forget: a failed bookmark
// write must never block or interrupt reading, same reasoning as
// enrollment.ts's own notifyProgram40Completed comment ("Never
// awaited/blocking").
export function saveReadingProgress(userId: string, chapterNumber: number): void {
  supabase
    .from('profiles')
    .update({ last_read_chapter: chapterNumber, last_read_at: new Date().toISOString() })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) console.error('[bookReader] save reading progress failed:', error.message)
    })
}
