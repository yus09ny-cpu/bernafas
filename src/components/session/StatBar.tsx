import { formatDuration } from '@/lib/utils'
import type { SessionStats } from '@/lib/sessionStats'
import StatTile from '@/components/session/StatTile'

interface StatBarProps {
  stats: SessionStats
  elapsedSec: number
  cycleCount: number
}

// Skrin 4's top stat row — Coherence score / Length / Achievement %, per the
// brief. All three are pure derivations of the same `history`/`elapsedSec`
// that drive every other chart on this page (see sessionStats.ts).
export default function StatBar({ stats, elapsedSec, cycleCount }: StatBarProps) {
  return (
    <div className="flex w-full gap-2">
      <StatTile
        value={stats.avgCoherence !== null ? String(Math.round(stats.avgCoherence * 100)) : '—'}
        label="Skor HRV"
      />
      <StatTile value={formatDuration(elapsedSec)} label="Tempoh" sub={`${cycleCount} nafas`} />
      <StatTile value={stats.achievementPct !== null ? `${stats.achievementPct}%` : '—'} label="Pencapaian" />
    </div>
  )
}
