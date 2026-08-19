import { useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { useWakeLock } from '@/hooks/useWakeLock'
import { formatDuration, cn } from '@/lib/utils'
import { saveProgram40Session } from '@/lib/program40/sessions'
import { recomputeEnrollmentProgress } from '@/lib/program40/enrollment'
import { recordSessionCompleted } from '@/lib/unlockBonus'
import { Slider } from '@/components/ui/slider'
import SelfRatingPreset from '@/components/program40/SelfRatingPreset'
import StepGuide from '@/components/program40/StepGuide'
import { TECHNIQUE_META, type Program40Technique } from '@/lib/program40/curriculum'
import type { Program40SelfRating } from '@/lib/program40/types'

interface ManualSessionRunnerProps {
  userId: string
  dayNumber: number
  technique: Program40Technique
  onDone: () => void
  onCancel: () => void
}

type Step = 'idle' | 'running' | 'rating'

// Pacer range per the book's own Bab 7 table — 5s/5s is the example pace
// given (the book itself gives no fixed "correct" number, "yang penting
// selesa"), matching useBreathingPacer's existing app-wide default, so this
// is a range around the established default, not a new number.
const BREATH_SECONDS_MIN = 4
const BREATH_SECONDS_MAX = 7
const BREATH_SECONDS_DEFAULT = 5

// device_used=false branch of the 40-day module (spec item 3) — a live
// step-by-step guide (StepGuide.tsx, content from techniqueContent.ts) plus
// an independent elapsed-time timer, no BLE/useHeartRateMonitor involved at
// all, ending in the 3-preset self-rating (SelfRatingPreset.tsx) instead of
// a live-HRV summary. No hrv_score is ever produced or sent on this path
// (see saveProgram40Session's call below) — matching
// program_40_day_sessions' check constraint that self_rating and hrv_score
// are mutually exclusive. The session timer/"Selesai" button is fully
// independent of StepGuide's own step position — the user can revisit
// steps freely and end whenever they're ready, matching the book's own
// "durasi tak tentu, ikut rasa masing-masing" framing (e.g. Nafas Sikap's
// Langkah 6).
export default function ManualSessionRunner({ userId, dayNumber, technique, onDone, onCancel }: ManualSessionRunnerProps) {
  const [step, setStep] = useState<Step>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [rating, setRating] = useState<Program40SelfRating | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [inhaleSeconds, setInhaleSeconds] = useState(BREATH_SECONDS_DEFAULT)
  const [exhaleSeconds, setExhaleSeconds] = useState(BREATH_SECONDS_DEFAULT)
  // Only ever populated by StepGuide for Beku & Tanya's Akui/Bertindak
  // textareas — stays '' (saved as null) for every other technique.
  const [notes, setNotes] = useState('')
  const startRef = useRef<number>(0)
  const wakeLock = useWakeLock()

  useEffect(() => {
    if (step !== 'running') return
    const id = window.setInterval(() => {
      setElapsedSec(Math.round((performance.now() - startRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [step])

  const start = () => {
    startRef.current = performance.now()
    setElapsedSec(0)
    setStep('running')
    wakeLock.request()
  }

  const stop = () => {
    wakeLock.release()
    setStep('rating')
  }

  const save = async () => {
    if (!rating) return
    setSaving(true)
    setSaveError(null)
    const { error } = await saveProgram40Session({
      userId,
      dayNumber,
      technique,
      durationSeconds: elapsedSec,
      deviceUsed: false,
      selfRating: rating,
      notes: notes.trim() ? notes : null,
    })
    if (error) {
      setSaveError(error)
      setSaving(false)
      return
    }
    await recomputeEnrollmentProgress(userId)
    // Sesi tanpa-device turut dikira ke arah unlockBonus's 10-sesi/21-hari
    // threshold (spec item 7) — same device-agnostic local counter
    // DeviceSessionRunner's finishAndSave calls.
    recordSessionCompleted()
    setSaving(false)
    onDone()
  }

  if (step === 'rating') {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center"
        style={{ paddingBottom: 'calc(var(--nav-height) + 2rem + var(--safe-bottom))' }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl font-extrabold tabular-nums text-[var(--color-primary-dark)]">{formatDuration(elapsedSec)}</span>
          <span className="text-sm text-[var(--color-text-muted)]">Sesi selesai</span>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-2">
          <span className="text-sm font-medium text-[var(--color-text)]">Bagaimana rasa hati anda sekarang?</span>
          <SelfRatingPreset value={rating} onChange={setRating} />
        </div>

        {saveError && <p className="max-w-xs text-sm text-[var(--color-warm)]">Gagal simpan: {saveError}</p>}

        <button
          type="button"
          onClick={save}
          disabled={!rating || saving}
          className="w-full max-w-xs rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
        >
          {saving ? 'Menyimpan...' : 'Simpan & Selesai'}
        </button>
      </div>
    )
  }

  if (step === 'running') {
    return (
      <div
        className="flex h-full w-full flex-col overflow-y-auto px-6"
        style={{ paddingTop: 'calc(1.5rem + var(--safe-top))', paddingBottom: 'calc(var(--nav-height) + 2rem + var(--safe-bottom))' }}
      >
        {/* paddingLeft clears App.tsx's fixed top-left AccountMenu button —
            same --account-menu-clear convention SessionHeader.tsx already
            uses for the Sesi tab's own floating header, needed here too
            since this row sits at the same top offset. */}
        <div className="mb-4 flex items-center justify-between" style={{ paddingLeft: 'var(--account-menu-clear)' }}>
          <span className="text-sm font-medium text-[var(--color-text-muted)]">{TECHNIQUE_META[technique].label}</span>
          <span className="text-lg font-bold tabular-nums text-[var(--color-primary-dark)]">{formatDuration(elapsedSec)}</span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-4">
          <StepGuide technique={technique} inhaleMs={inhaleSeconds * 1000} exhaleMs={exhaleSeconds * 1000} onNotesChange={setNotes} />
          <BreathTimingControl inhaleSeconds={inhaleSeconds} exhaleSeconds={exhaleSeconds} onInhaleChange={setInhaleSeconds} onExhaleChange={setExhaleSeconds} />
        </div>

        <button
          onClick={stop}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95"
        >
          <Square size={18} /> Selesai
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col items-center justify-between px-6 py-10 text-center"
      style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(var(--nav-height) + 2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col items-center gap-1 pt-4">
        <span className="text-sm font-medium text-[var(--color-text-muted)]">Latihan Tanpa Peranti</span>
        <span className="text-lg font-bold text-[var(--color-primary-dark)]">{TECHNIQUE_META[technique].label}</span>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
          Tiada Bluetooth diperlukan — panduan langkah demi langkah untuk sesi ini.
        </p>
        <BreathTimingControl inhaleSeconds={inhaleSeconds} exhaleSeconds={exhaleSeconds} onInhaleChange={setInhaleSeconds} onExhaleChange={setExhaleSeconds} />
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={start}
          className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95"
        >
          <Play size={18} /> Mula
        </button>
        <button
          onClick={onCancel}
          className="rounded-full px-6 py-3 text-sm font-medium text-[var(--color-text-muted)] underline-offset-4 hover:underline"
        >
          Batal
        </button>
      </div>
    </div>
  )
}

// Spec item 5 — adjustable before OR during the session (rendered in both
// the idle and running screens above, same component). 4-7s range per the
// book's own pacer table; 5s/5s stays the default either way.
function BreathTimingControl({
  inhaleSeconds,
  exhaleSeconds,
  onInhaleChange,
  onExhaleChange,
}: {
  inhaleSeconds: number
  exhaleSeconds: number
  onInhaleChange: (value: number) => void
  onExhaleChange: (value: number) => void
}) {
  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl bg-white/60 p-4">
      <BreathTimingRow label="Tarikan Nafas" value={inhaleSeconds} onChange={onInhaleChange} />
      <BreathTimingRow label="Hembusan Nafas" value={exhaleSeconds} onChange={onExhaleChange} />
    </div>
  )
}

function BreathTimingRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-medium text-[var(--color-text)]')}>{label}</span>
        <span className="font-semibold text-[var(--color-primary)]">{value}s</span>
      </div>
      <Slider
        value={[value]}
        min={BREATH_SECONDS_MIN}
        max={BREATH_SECONDS_MAX}
        step={1}
        onValueChange={([v]) => onChange(v ?? BREATH_SECONDS_DEFAULT)}
        aria-label={label}
      />
    </div>
  )
}
