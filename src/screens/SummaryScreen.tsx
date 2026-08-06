import { RotateCcw } from 'lucide-react'
import CoherenceRing from '@/components/CoherenceRing'
import TrendSparkline from '@/components/TrendSparkline'
import UnlockBonusCard from '@/components/UnlockBonusCard'
import type { SessionSummary } from '@/hooks/useHrvSession'

interface SummaryScreenProps {
  summary: SessionSummary
  breathCount: number
  showUnlockBonus: boolean
  onNewSession: () => void
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function SummaryScreen({ summary, breathCount, showUnlockBonus, onNewSession }: SummaryScreenProps) {
  const hasScore = summary.usedDevice && summary.avgCoherence !== null

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-between px-6 py-8 text-center"
      style={{ paddingTop: 'calc(2rem + var(--safe-top))', paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col items-center gap-1 pt-4">
        <span className="text-lg font-bold text-[var(--color-primary-dark)]">Sesi selesai</span>
        <span className="text-sm text-[var(--color-text-muted)]">
          {formatDuration(summary.durationSec)} · {breathCount} nafas
        </span>
      </div>

      <div className="flex flex-col items-center gap-6">
        {hasScore ? (
          <>
            <CoherenceRing value={summary.avgCoherence!} size={140} label="PURATA SKOR HRV" />
            {summary.startBpm !== null && summary.endBpm !== null && (
              <span className="text-sm text-[var(--color-text-muted)]">
                {summary.startBpm} → {summary.endBpm} bpm
              </span>
            )}
            <TrendSparkline points={summary.coherenceHistory} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/60 px-6 py-8">
            <span className="text-sm text-[var(--color-text)]">Sesi tanpa peranti HRV</span>
            <span className="max-w-xs text-xs text-[var(--color-text-muted)]">
              Sambungkan peranti HRV pada sesi akan datang untuk lihat skor HRV anda.
            </span>
          </div>
        )}

        {showUnlockBonus && <UnlockBonusCard />}
      </div>

      <button
        onClick={onNewSession}
        className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95"
      >
        <RotateCcw size={18} /> Sesi Baharu
      </button>
    </div>
  )
}
