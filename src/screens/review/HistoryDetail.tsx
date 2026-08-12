import { useEffect, useState } from 'react'
import { ChevronLeft, Loader2, Trash2 } from 'lucide-react'
import { deleteSession, fetchSessionDetail, type SessionDetail } from '@/lib/sessionsHistory'
import { formatDuration, formatSessionDate } from '@/lib/utils'
import StatTile from '@/components/session/StatTile'
import ZoneStatRow from '@/components/session/ZoneStatRow'
import CoherenceBandChart from '@/components/session/CoherenceBandChart'
import HrvLineChart from '@/components/session/HrvLineChart'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// History's detail view — a single session's report. Every stat below is
// either a stored column (low_pct/medium_pct/high_pct, avg_bpm,
// coherence_avg, duration_sec, achievement_pct — all written once by
// saveSession() at session end, see sessionPersistence.ts) or the two
// charts reused verbatim from Skrin 4 (CoherenceBandChart/HrvLineChart),
// fed this session's own stored `history` instead of a live stream.
// Nothing here is recomputed from `history` — using the same numbers the
// user actually saw live, not a second independently-derived copy.
//
// Delete lives here rather than as a per-row icon in HistoryList's table —
// that list is already a tight 4-column grid on a narrow viewport (see
// HistoryList.tsx's grid-cols comment), and each row is itself a `<button>`
// (opens this detail view), so a second tap target per row would mean
// either a nested button (invalid HTML) or restructuring every row. This
// screen is already "one session, opened" — a single header action reads
// clearer than a trash icon competing for space in every list row.
export default function HistoryDetail({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await deleteSession(sessionId)
    setDeleting(false)
    if (error) {
      setDeleteError(error)
      return
    }
    setConfirmOpen(false)
    // Back to HistoryList, which HistoryTab.tsx mounts fresh (it's the
    // list/detail toggle's other branch, not a shared instance) — its own
    // useEffect re-fetches on mount, so the deleted row is gone from the
    // list without any manual cache-busting here.
    onBack()
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-[var(--color-primary-dark)]"
        >
          <ChevronLeft size={18} /> Kembali
        </button>
        {session && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label="Padam sesi ini"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-destructive)]/10"
          >
            <Trash2 size={14} /> Padam
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Padam sesi ini?"
        description="Rekod sesi ini akan dipadam selama-lamanya dan tidak boleh dipulihkan."
        confirmLabel="Padam"
        cancelLabel="Batal"
        destructive
        busy={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => {
          if (deleting) return
          setConfirmOpen(false)
          setDeleteError(null)
        }}
      />

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
