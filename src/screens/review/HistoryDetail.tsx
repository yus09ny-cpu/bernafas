import { useEffect, useState } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { fetchSessionDetail, type SessionDetail } from '@/lib/sessionsHistory'
import { formatDuration, formatSessionDate } from '@/lib/utils'
import StatTile from '@/components/session/StatTile'
import ZoneStatRow from '@/components/session/ZoneStatRow'
import CoherenceBandChart from '@/components/session/CoherenceBandChart'
import HrvLineChart from '@/components/session/HrvLineChart'

// History's detail view — a single session's report. Every stat below is
// either a stored column (low_pct/medium_pct/high_pct, avg_bpm,
// coherence_avg, duration_sec, achievement_pct — all written once by
// saveSession() at session end, see sessionPersistence.ts) or the two
// charts reused verbatim from Skrin 4 (CoherenceBandChart/HrvLineChart),
// fed this session's own stored `history` instead of a live stream.
// Nothing here is recomputed from `history` — using the same numbers the
// user actually saw live, not a second independently-derived copy.
export default function HistoryDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSession(null)
    setError(null)
    fetchSessionDetail(sessionId).then(({ data, error }) => {
      if (cancelled) return
      setSession(data)
      setError(error)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  return (
    <div className="flex w-full flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start text-sm font-medium text-[var(--color-primary-dark)]"
      >
        <ChevronLeft size={18} /> Kembali
      </button>

      {!session && !error && (
        <div className="flex w-full flex-col items-center gap-2 py-10">
          <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
        </div>
      )}

      {error && (
        <div className="flex w-full flex-col items-center gap-1 rounded-2xl border border-[var(--color-card-border)] bg-white/60 px-6 py-8 text-center shadow-[var(--shadow-soft)]">
          <span className="text-sm text-[var(--color-text)]">Gagal memuatkan sesi ini</span>
          <span className="text-xs text-[var(--color-text-muted)]">{error}</span>
        </div>
      )}

      {session && (
        <>
          <span className="text-sm font-semibold text-[var(--color-text)]">{formatSessionDate(session.startedAt)}</span>

          <ZoneStatRow low={session.lowPct} medium={session.mediumPct} high={session.highPct} />

          <div className="flex w-full gap-2">
            <StatTile value={session.avgBpm !== null ? String(session.avgBpm) : '—'} label="BPM" />
            <StatTile
              value={session.coherenceAvg !== null ? String(Math.round(session.coherenceAvg * 100)) : '—'}
              label="Koheren"
            />
            <StatTile value={session.durationSec !== null ? formatDuration(session.durationSec) : '—'} label="Tempoh" />
            <StatTile value={session.achievementPct !== null ? `${session.achievementPct}%` : '—'} label="Pencapaian" />
          </div>

          <CoherenceBandChart history={session.history} />
          <HrvLineChart history={session.history} />
        </>
      )}
    </div>
  )
}
