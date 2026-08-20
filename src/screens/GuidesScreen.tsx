import Program40Hub from '@/screens/program40/Program40Hub'
import FullBookCard from '@/components/book/FullBookCard'

// Panduan tab — hosts the 40-day guided program module (see
// src/screens/program40/), chosen over Jurnal (free-form post-session
// reflection) as this module's home: a structured, technique-per-phase
// curriculum reads as "panduan" (guidance), not a journal entry.
//
// FullBookCard (added alongside the purchase-gated full-book delivery
// work) sits ABOVE Program40Hub rather than replacing this screen's
// layout — Program40Hub renders its own full-height view internally
// (loading/landing/home/session/dashboard), so the book card wraps it in
// a scrollable column instead of being squeezed into that internal layout.
export default function GuidesScreen() {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      <div className="px-4 pt-[calc(1rem+var(--safe-top))]">
        <FullBookCard />
      </div>
      <div className="min-h-0 flex-1">
        <Program40Hub />
      </div>
    </div>
  )
}
