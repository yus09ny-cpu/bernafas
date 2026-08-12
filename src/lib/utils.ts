import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Review's History list/detail date column — BM month names ("11 Ogos
// 2026"), matching the app's Bahasa Melayu copy everywhere else.
export function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

// History list's Tarikh column pairs this with formatSessionDate (date on
// its own line, this underneath) so two sessions on the same day are
// distinguishable — ms-MY's Intl output already gives BM "PG"/"PTG"
// (pagi/petang) instead of AM/PM, no manual mapping needed. Kept separate
// from formatSessionDate rather than merged into one string so callers that
// only want the date (chart axis labels, HistoryDetail's header) are
// unaffected.
export function formatSessionTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ms-MY', { hour: 'numeric', minute: '2-digit' })
}
