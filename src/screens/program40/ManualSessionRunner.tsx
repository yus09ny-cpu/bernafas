import { useEffect, useRef, useState } from 'react'
import { Timer, Play, Square } from 'lucide-react'
import { useWakeLock } from '@/hooks/useWakeLock'
import { formatDuration } from '@/lib/utils'
import { saveProgram40Session } from '@/lib/program40/sessions'
import { recomputeEnrollmentProgress } from '@/lib/program40/enrollment'
import { recordSessionCompleted } from '@/lib/unlockBonus'
import SelfRatingPreset from '@/components/program40/SelfRatingPreset'
import type { Program40SelfRating } from '@/lib/program40/types'
import type { Program40Technique } from '@/lib/program40/curriculum'

interface ManualSessionRunnerProps {
  userId: string
  dayNumber: number
  technique: Program40Technique
  onDone: () => void
  onCancel: () => void
}

type Step = 'idle' | 'running' | 'rating'

// device_used=false branch of the 40-day module (spec item 3) — a plain
// elapsed-time timer, no BLE/useHeartRateMonitor involved at all, ending in
// the 3-preset self-rating (SelfRatingPreset.tsx) instead of a live-HRV
// summary. No hrv_score is ever produced or sent on this path (see
// saveProgram40Session's call below) — matching program_40_day_sessions'
// check constraint that self_rating and hrv_score are mutually exclusive.
export default function ManualSessionRunner({ userId, dayNumber, technique, onDone, onCancel }: ManualSessionRunnerProps) {
  const [step, setStep] = useState<Step>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [rating, setRating] = useState<Program40SelfRating | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
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

  return (
    <div
      className="flex h-full flex-col items-center justify-between px-6 py-10 text-center"
      style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(var(--nav-height) + 2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col items-center gap-1 pt-4">
        <span className="text-sm font-medium text-[var(--color-text-muted)]">Latihan Tanpa Peranti</span>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div
          className="flex h-44 w-44 items-center justify-center rounded-full bg-white/70"
          style={{ boxShadow: '0 10px 40px rgba(63,140,140,0.15)' }}
        >
          {step === 'running' ? (
            <span className="text-4xl font-extrabold tabular-nums text-[var(--color-primary-dark)]">{formatDuration(elapsedSec)}</span>
          ) : (
            <Timer size={56} className="text-[var(--color-accent)]" />
          )}
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
          {step === 'running' ? 'Teruskan bernafas dengan tenang.' : 'Tiada Bluetooth diperlukan — pemasa sahaja untuk sesi ini.'}
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {step === 'running' ? (
          <button
            onClick={stop}
            className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95"
          >
            <Square size={18} /> Selesai
          </button>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
