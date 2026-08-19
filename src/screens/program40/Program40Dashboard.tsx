import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bluetooth, Timer } from 'lucide-react'
import { fetchProgram40Sessions, computeStreak } from '@/lib/program40/sessions'
import { PHASE_META, TECHNIQUE_META, PROGRAM_40_DAY_TOTAL, getPhaseForDay } from '@/lib/program40/curriculum'
import { formatDuration, formatSessionDate, cn } from '@/lib/utils'
import type { Program40Enrollment, Program40Session } from '@/lib/program40/types'

interface Program40DashboardProps {
  userId: string
  enrollment: Program40Enrollment
  onBack: () => void
}

type RecordTab = 'device' | 'manual'

const PHASE_BLOCKS: Array<{ phase: keyof typeof PHASE_META; days: number[] }> = [
  { phase: 'fondasi', days: Array.from({ length: 14 }, (_, i) => i + 1) },
  { phase: 'pendalaman', days: Array.from({ length: 14 }, (_, i) => i + 15) },
  { phase: 'integrasi', days: Array.from({ length: 12 }, (_, i) => i + 29) },
]

// Spec item 4 — 40-day calendar + two device/no-device tabs, split purely
// by each row's own device_used column (not two different tables). Streak
// (computeStreak, sessions.ts) is deliberately computed from ALL session
// dates combined, never re-derived per tab — a device day and a no-device
// day the next day still form one unbroken streak.
export default function Program40Dashboard({ userId, enrollment, onBack }: Program40DashboardProps) {
  const [sessions, setSessions] = useState<Program40Session[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<RecordTab>('device')

  useEffect(() => {
    let cancelled = false
    fetchProgram40Sessions(userId).then(({ data }) => {
      if (!cancelled) {
        setSessions(data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const streak = useMemo(() => computeStreak(sessions.map(s => s.sessionDate)), [sessions])

  // First session found per day_number decides that day's calendar dot
  // color when the day has both a device and a no-device session logged
  // (an extra same-day practice) — device_used=true wins visually since a
  // device session is the "fuller" record of the two.
  const dayState = useMemo(() => {
    const map = new Map<number, { deviceUsed: boolean }>()
    for (const s of sessions) {
      const existing = map.get(s.dayNumber)
      if (!existing || (!existing.deviceUsed && s.deviceUsed)) map.set(s.dayNumber, { deviceUsed: s.deviceUsed })
    }
    return map
  }, [sessions])

  const filteredSessions = useMemo(
    () => sessions.filter(s => (tab === 'device' ? s.deviceUsed : !s.deviceUsed)).slice().reverse(),
    [sessions, tab],
  )

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto px-5"
      style={{
        paddingTop: 'calc(1.5rem + var(--safe-top))',
        paddingBottom: 'calc(var(--nav-height) + 2rem + var(--safe-bottom))',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)]"
      >
        <ArrowLeft size={14} /> Kembali
      </button>

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--color-primary-dark)]">Latihan 40 Hari</h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            Hari {enrollment.currentDay} / {PROGRAM_40_DAY_TOTAL} · {PHASE_META[getPhaseForDay(Math.max(1, enrollment.currentDay))].label}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-extrabold tabular-nums text-[var(--color-primary)]">{streak}</span>
          <span className="text-[10px] font-medium text-[var(--color-text-muted)]">hari berturut</span>
        </div>
      </div>

      {/* Calendar — one grid per phase block, 7 columns per row. */}
      <div className="mb-6 flex flex-col gap-4">
        {PHASE_BLOCKS.map(({ phase, days }) => (
          <div key={phase}>
            <p className="mb-2 text-xs font-semibold text-[var(--color-text-muted)]">
              {PHASE_META[phase].label} · {PHASE_META[phase].weekRangeLabel}
            </p>
            <div className="grid grid-cols-7 gap-2">
              {days.map(day => {
                const state = dayState.get(day)
                const isToday = day === enrollment.currentDay + 1 && enrollment.status === 'active'
                return (
                  <div
                    key={day}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-lg text-[11px] font-semibold',
                      state
                        ? state.deviceUsed
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-accent)]/80 text-white'
                        : isToday
                        ? 'bg-white text-[var(--color-primary-dark)] ring-2 ring-[var(--color-primary)]'
                        : 'bg-white/50 text-[var(--color-text-muted)]',
                    )}
                  >
                    {day}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-1 flex gap-2 text-[10px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-[var(--color-primary)]" /> Dengan peranti
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-[var(--color-accent)]/80" /> Tanpa peranti
        </span>
      </div>

      {/* Two record tabs, split by device_used. */}
      <div className="mt-5 mb-3 flex gap-2">
        {(
          [
            { id: 'device' as const, label: 'Rekod Peranti', Icon: Bluetooth },
            { id: 'manual' as const, label: 'Rekod Tanpa Peranti', Icon: Timer },
          ]
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-colors',
              tab === id ? 'bg-[var(--color-primary)] text-white' : 'bg-white/70 text-[var(--color-text-muted)]',
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">Memuatkan...</p>
        ) : filteredSessions.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
            Belum ada rekod {tab === 'device' ? 'dengan peranti' : 'tanpa peranti'} lagi.
          </p>
        ) : (
          filteredSessions.map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-xl bg-white/70 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[var(--color-text)]">
                  Hari {s.dayNumber} · {TECHNIQUE_META[s.technique].label}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {formatSessionDate(s.sessionDate)} · {formatDuration(s.durationSeconds)}
                </span>
              </div>
              <span className="text-sm font-semibold text-[var(--color-primary-dark)]">
                {s.deviceUsed ? (s.hrvScore !== null ? `${Math.round(s.hrvScore)}%` : '—') : SELF_RATING_LABEL[s.selfRating ?? 'biasa']}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const SELF_RATING_LABEL: Record<string, string> = {
  tenang: 'Tenang',
  biasa: 'Biasa',
  resah: 'Masih Resah',
}
