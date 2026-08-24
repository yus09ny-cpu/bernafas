import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchSessionsTrend, type SessionTrendPoint } from '@/lib/sessionsHistory'
import { computeAwards, lifetimeCoherenceMinutes, type AwardStatus } from '@/lib/awards'
import BadgeTile from '@/components/awards/BadgeTile'
import BadgeDetail from '@/components/awards/BadgeDetail'

// Anugerah — badges computed client-side from the same sessions rows
// History/Progress already read (fetchSessionsTrend, ascending — see
// lib/awards.ts's header comment on why ordering matters here). No new
// table, no new columns: every badge condition is a pure function of
// columns saveSession() already writes.
export default function AwardsTab() {
  const [sessions, setSessions] = useState<SessionTrendPoint[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AwardStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSessionsTrend().then(({ data, error }) => {
      if (cancelled) return
      setSessions(data)
      setError(error)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (sessions === null) {
    return (
      <div className="flex w-full flex-col items-center gap-2 py-10">
        <Loader2 size={28} className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-1 rounded-2xl border border-[var(--color-card-border)] bg-white/60 px-6 py-8 text-center shadow-[var(--shadow-soft)]">
        <span className="text-sm text-[var(--color-text)]">Gagal memuatkan anugerah</span>
        <span className="text-xs text-[var(--color-text-muted)]">{error}</span>
      </div>
    )
  }

  const lifetimeMinutes = lifetimeCoherenceMinutes(sessions)
  const groups = computeAwards(sessions)

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--color-card-border)] bg-white/70 py-6 shadow-[var(--shadow-soft)]">
        <span className="text-center text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Jumlah Pencapaian Sepanjang Hayat
        </span>
        <span className="text-4xl font-extrabold tabular-nums text-[var(--color-primary-dark)]">
          {lifetimeMinutes.toLocaleString('ms-MY')}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">minit dalam koheren</span>
      </div>

      {sessions.length === 0 ? (
        <div className="flex w-full flex-col items-center gap-1 rounded-2xl border border-[var(--color-card-border)] bg-white/60 px-6 py-8 text-center shadow-[var(--shadow-soft)]">
          <span className="text-sm text-[var(--color-text)]">Belum ada anugerah</span>
          <span className="max-w-xs text-xs text-[var(--color-text-muted)]">
            Selesaikan sesi pernafasan pertama anda untuk mula membuka anugerah.
          </span>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.category} className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{group.title}</span>
            <div className="grid grid-cols-3 gap-3">
              {group.badges.map(badge => (
                <BadgeTile key={badge.id} badge={badge} onSelect={setSelected} />
              ))}
            </div>
          </div>
        ))
      )}

      <BadgeDetail badge={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
