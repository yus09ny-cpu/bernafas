import type { ReactNode } from 'react'

// Shared card chrome for the three Skrin 4 charts (HrvLineChart,
// CoherenceBandChart, RmssdTrendChart) — same title treatment, surface,
// border, and shadow as StatBar's tiles and PulseReadout, so the page reads
// as one consistent stack of distinct cards rather than a continuous
// scroll. Uses --color-card-border (not the general --color-border) plus
// --shadow-soft (already used elsewhere in the app) — --color-border alone
// measured at ~1.1-1.2:1 contrast against this card's own background,
// essentially invisible; see index.css for the actual numbers.
export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-[var(--color-card-border)] bg-white/70 p-4 shadow-[var(--shadow-soft)]">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</span>
      {children}
    </div>
  )
}

// message defaults to the original device-focused copy (Skrin 4's own
// three charts, which are always empty for the same one reason — no HRV
// device this session); Progress's trend charts pass their own wording
// since "connect a device" would be wrong there — the real cause is too
// few *sessions* recorded yet, not this session lacking a device.
export function ChartEmptyState({ message = 'Sambungkan peranti HRV untuk lihat carta ini' }: { message?: string }) {
  return <div className="flex h-24 items-center justify-center px-4 text-center text-xs text-[var(--color-text-muted)]">{message}</div>
}
