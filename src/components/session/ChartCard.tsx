import type { ReactNode } from 'react'

// Shared card chrome for the three Skrin 4 charts (HrvLineChart,
// CoherenceBandChart, RmssdTrendChart) — same title treatment and surface
// as StatBar's tiles, so the page reads as one consistent stack of cards.
export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl bg-white/70 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</span>
      {children}
    </div>
  )
}

export function ChartEmptyState() {
  return (
    <div className="flex h-24 items-center justify-center text-xs text-[var(--color-text-muted)]">
      Sambungkan peranti HRV untuk lihat carta ini
    </div>
  )
}
