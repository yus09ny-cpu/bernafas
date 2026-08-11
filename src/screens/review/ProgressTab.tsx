import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchSessionsTrend, type SessionTrendPoint } from '@/lib/sessionsHistory'
import MinutesInCoherenceBarChart from '@/components/session/MinutesInCoherenceBarChart'
import SessionTrendAreaChart from '@/components/session/SessionTrendAreaChart'

// Progress's four cards, oldest-to-newest left-to-right, all fed from one
// fetch (fetchSessionsTrend — no `history`, just the per-session aggregate
// columns saveSession() already writes; see sessionsHistory.ts). Each
// chart picks its own field/color/formatter but shares the same
// SessionTrendAreaChart (or MinutesInCoherenceBarChart for the one bar
// chart) so all four stay visually and behaviorally identical in how they
// scale, empty-state, and label — see those components for the low-data
// handling (1 bar still renders; an area/line needs 2 points minimum,
// same floor HrvLineChart/RmssdTrendChart already use, with a message that
// says so instead of looking broken).
export default function ProgressTab() {
  const [trend, setTrend] = useState<SessionTrendPoint[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSessionsTrend().then(({ data, error }) => {
      if (cancelled) return
      setTrend(data)
      setError(error)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (trend === null) {
    return (
      <div className="flex w-full flex-col items-center gap-2 py-10">
        <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-1 rounded-2xl border border-[var(--color-card-border)] bg-white/60 px-6 py-8 text-center shadow-[var(--shadow-soft)]">
        <span className="text-sm text-[var(--color-text)]">Gagal memuatkan trend</span>
        <span className="text-xs text-[var(--color-text-muted)]">{error}</span>
      </div>
    )
  }

  if (trend.length === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-1 rounded-2xl border border-[var(--color-card-border)] bg-white/60 px-6 py-8 text-center shadow-[var(--shadow-soft)]">
        <span className="text-sm text-[var(--color-text)]">Belum ada sesi direkodkan</span>
        <span className="max-w-xs text-xs text-[var(--color-text-muted)]">
          Trend muncul di sini selepas anda ada beberapa sesi direkodkan.
        </span>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <MinutesInCoherenceBarChart data={trend} />
      <SessionTrendAreaChart
        title="Pencapaian"
        data={trend}
        value={p => p.achievementPct}
        color="#3e9c9c"
        format={v => `${Math.round(v)}%`}
      />
      <SessionTrendAreaChart
        title="Purata Koheren"
        data={trend}
        value={p => p.coherenceAvg}
        color="#6fa8dc"
        format={v => String(Math.round(v * 100))}
      />
      <SessionTrendAreaChart
        title="Purata BPM"
        data={trend}
        value={p => p.avgBpm}
        color="#6fc3bd"
        format={v => String(Math.round(v))}
      />
    </div>
  )
}
