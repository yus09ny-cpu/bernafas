import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchSessionsList, type SessionListItem } from '@/lib/sessionsHistory'
import { formatDuration, formatSessionDate } from '@/lib/utils'

// History's list view — the signed-in user's past sessions, most recent
// first (fetchSessionsList already orders started_at desc). `sessions ===
// null` is the loading state (distinct from `[]`, an empty-but-loaded
// list) so a brand-new user with zero sessions doesn't briefly flash an
// empty-state message before the real (still-loading) request resolves.
export default function HistoryList({ onSelect }: { onSelect: (id: string) => void }) {
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSessionsList().then(({ data, error }) => {
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
        <span className="text-sm text-[var(--color-text)]">Gagal memuatkan sejarah sesi</span>
        <span className="text-xs text-[var(--color-text-muted)]">{error}</span>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex w-full flex-col items-center gap-1 rounded-2xl border border-[var(--color-card-border)] bg-white/60 px-6 py-8 text-center shadow-[var(--shadow-soft)]">
        <span className="text-sm text-[var(--color-text)]">Belum ada sesi direkodkan</span>
        <span className="max-w-xs text-xs text-[var(--color-text-muted)]">
          Selesaikan sesi pernafasan pertama anda untuk lihat sejarah di sini.
        </span>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--color-card-border)] bg-white/70 shadow-[var(--shadow-soft)]">
        <div className="grid grid-cols-4 gap-2 border-b border-[var(--color-card-border)]/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          <span>Tarikh</span>
          <span>Tempoh</span>
          <span>Koheren</span>
          <span className="text-right">Pencapaian</span>
        </div>
        {sessions.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className="grid grid-cols-4 gap-2 border-b border-[var(--color-card-border)]/20 px-4 py-3 text-left text-sm text-[var(--color-text)] transition-colors last:border-b-0 hover:bg-[var(--color-primary)]/5 active:bg-[var(--color-primary)]/10"
          >
            <span className="tabular-nums">{formatSessionDate(s.startedAt)}</span>
            <span className="tabular-nums">{s.durationSec !== null ? formatDuration(s.durationSec) : '—'}</span>
            <span className="tabular-nums">{s.coherenceAvg !== null ? Math.round(s.coherenceAvg * 100) : '—'}</span>
            <span className="text-right tabular-nums">{s.achievementPct !== null ? `${s.achievementPct}%` : '—'}</span>
          </button>
        ))}
      </div>
      <span className="text-center text-xs text-[var(--color-text-muted)]">{sessions.length} sesi direkodkan</span>
    </div>
  )
}
