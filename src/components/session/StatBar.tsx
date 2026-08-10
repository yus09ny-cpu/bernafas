import { formatDuration } from '@/lib/utils'
import type { SessionStats } from '@/lib/sessionStats'

interface StatBarProps {
  stats: SessionStats
  elapsedSec: number
  cycleCount: number
}

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-[var(--color-card-border)] bg-white/70 py-4 shadow-[var(--shadow-soft)]">
      <span className="text-2xl font-extrabold tabular-nums text-[var(--color-primary-dark)]">{value}</span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</span>
      {sub && <span className="text-[11px] text-[var(--color-text-muted)]">{sub}</span>}
    </div>
  )
}

// Skrin 4's top stat row — Coherence score / Length / Achievement %, per the
// brief. All three are pure derivations of the same `history`/`elapsedSec`
// that drive every other chart on this page (see sessionStats.ts).
export default function StatBar({ stats, elapsedSec, cycleCount }: StatBarProps) {
  return (
    <div className="flex w-full gap-2">
      <Stat
        value={stats.avgCoherence !== null ? String(Math.round(stats.avgCoherence * 100)) : '—'}
        label="Skor HRV"
      />
      <Stat value={formatDuration(elapsedSec)} label="Tempoh" sub={`${cycleCount} nafas`} />
      <Stat value={stats.achievementPct !== null ? `${stats.achievementPct}%` : '—'} label="Pencapaian" />
    </div>
  )
}
