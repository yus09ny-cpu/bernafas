import { Heart } from 'lucide-react'
import type { SessionStats } from '@/lib/sessionStats'

interface PulseReadoutProps {
  currentBpm: number | null
  stats: SessionStats
}

// "Pulse (BPM) readout" — the plain current-vs-average number, separate
// from the two line charts above (which show the shape over time, not a
// glanceable single value).
export default function PulseReadout({ currentBpm, stats }: PulseReadoutProps) {
  return (
    <div className="flex w-full items-center justify-center gap-6 rounded-2xl border border-[var(--color-card-border)] bg-white/70 px-6 py-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2">
        <Heart size={18} className="text-[var(--color-warm)]" fill="currentColor" />
        <span className="text-2xl font-extrabold tabular-nums text-[var(--color-primary-dark)]">
          {currentBpm ?? '—'}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">bpm semasa</span>
      </div>
      {stats.avgBpm !== null && (
        <div className="flex flex-col items-center">
          <span className="text-sm font-semibold tabular-nums text-[var(--color-text)]">{stats.avgBpm}</span>
          <span className="text-[11px] text-[var(--color-text-muted)]">purata</span>
        </div>
      )}
    </div>
  )
}
