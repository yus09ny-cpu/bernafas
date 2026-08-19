import { useState } from 'react'
import ConnectScreen from '@/screens/ConnectScreen'
import SessionCarousel from '@/components/session/SessionCarousel'
import { useHrvSession } from '@/hooks/useHrvSession'
import { useBreathingPacer } from '@/hooks/useBreathingPacer'
import { useZoneDominance } from '@/hooks/useZoneDominance'
import { computeSessionStats } from '@/lib/sessionStats'
import { recordSessionCompleted } from '@/lib/unlockBonus'
import { saveProgram40Session } from '@/lib/program40/sessions'
import { recomputeEnrollmentProgress } from '@/lib/program40/enrollment'
import type { Program40Technique } from '@/lib/program40/curriculum'
import type { LiveSessionData } from '@/screens/session/types'

const INHALE_MS = 5000
const EXHALE_MS = 5000

interface DeviceSessionRunnerProps {
  userId: string
  dayNumber: number
  technique: Program40Technique
  // Called once the session is saved (or the user backs out before ever
  // connecting) — always returns to Program40SessionScreen's choice step.
  onDone: () => void
  onCancel: () => void
}

// device_used=true branch of the 40-day module (spec item 3) — the connect
// gate + 4-page carousel are the SAME useHrvSession/useBreathingPacer/
// useZoneDominance/SessionCarousel wiring SessionScreen.tsx (the Sesi tab)
// uses, just saved to program_40_day_sessions instead of `sessions` at the
// end, and with no restart loop (this is a one-off scheduled session, not a
// reusable tab) — the carousel's second "end" press saves-and-exits
// (endedLabel override) rather than looping back to ConnectScreen.
export default function DeviceSessionRunner({ userId, dayNumber, technique, onDone, onCancel }: DeviceSessionRunnerProps) {
  const [started, setStarted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const hrv = useHrvSession()
  const pacer = useBreathingPacer({ inhaleMs: INHALE_MS, exhaleMs: EXHALE_MS, running: started })
  const zones = useZoneDominance(hrv.elapsedSec, hrv.coherenceLiveAlt)

  const beginSession = () => {
    hrv.startSession()
    setStarted(true)
  }

  // First "end" press — freezes the carousel into Skrin 4's summary, same
  // as the Sesi tab, so the user can review it before the save-and-exit
  // press below.
  const pauseSession = () => {
    hrv.endSession()
  }

  // Second press ("Simpan & Selesai", endedLabel override below) — actually
  // persists the session. hrvScore = Math.round(avgCoherence * 100), the
  // EXACT formula StatBar.tsx already labels "Skor HRV" on Skrin 4
  // (StatTile value={Math.round(stats.avgCoherence * 100)}) — deliberately
  // NOT achievementPct (that's a distinct, separately-labeled "Pencapaian"
  // stat on the same screen). Matching this keeps hrv_score consistent with
  // the one number the app already calls "the score" everywhere else,
  // rather than introducing a second, differently-scaled metric just for
  // this module.
  const finishAndSave = async () => {
    setSaving(true)
    setSaveError(null)
    const stats = computeSessionStats(hrv.history)
    const { error } = await saveProgram40Session({
      userId,
      dayNumber,
      technique,
      durationSeconds: hrv.elapsedSec,
      deviceUsed: true,
      hrvScore: stats.avgCoherence !== null ? Math.round(stats.avgCoherence * 100) : null,
    })
    if (error) {
      setSaveError(error)
      setSaving(false)
      return
    }
    await recomputeEnrollmentProgress(userId)
    // Sesi tanpa-device turut dikira ke arah unlockBonus's 10-sesi/21-hari
    // threshold (spec item 7) — recordSessionCompleted() is already
    // device-agnostic (a plain local counter), called identically from
    // ManualSessionRunner's finishAndSave.
    recordSessionCompleted()
    setSaving(false)
    onDone()
  }

  if (!started) {
    return (
      <ConnectScreen
        state={hrv.state}
        deviceName={hrv.deviceName}
        error={hrv.error}
        bpm={hrv.bpm}
        onConnect={hrv.connect}
        onContinue={beginSession}
        // ConnectScreen always renders a "Teruskan tanpa peranti" skip
        // button — repurposed here to back all the way out to the
        // DeviceChoicePopup (onCancel) rather than silently starting a
        // device_used=true session with no actual device data, which would
        // misrecord how this session was actually taken.
        onSkip={onCancel}
      />
    )
  }

  const data: LiveSessionData = {
    bpm: hrv.smoothedBpm,
    coherenceLive: hrv.coherenceLive,
    coherenceLiveAlt: hrv.coherenceLiveAlt,
    coherenceAltReady: hrv.coherenceAltReady,
    zones,
    history: hrv.history,
    elapsedSec: hrv.elapsedSec,
    contactLost: hrv.contactLost,
    isDeviceConnected: hrv.state === 'connected',
    sessionActive: hrv.sessionActive,
    phase: pacer.phase,
    phaseDurationMs: pacer.phase === 'in' ? INHALE_MS : EXHALE_MS,
    cycleCount: pacer.cycleCount,
    showUnlockBonus: false,
    beats: hrv.beats,
    device: hrv.device,
    simulated: hrv.simulated,
    sensorContact: hrv.sensorContact,
    breathCount: pacer.breathCount,
  }

  return (
    <div className="relative h-full w-full">
      <SessionCarousel
        data={data}
        onEndSession={hrv.sessionActive ? pauseSession : finishAndSave}
        endedLabel={saving ? 'Menyimpan...' : 'Simpan & Selesai'}
      />
      {saveError && (
        <div className="pointer-events-none absolute inset-x-0 z-40 flex justify-center" style={{ bottom: 'calc(var(--nav-height) + 5rem + var(--safe-bottom))' }}>
          <span className="pointer-events-auto rounded-full bg-[var(--color-destructive)] px-4 py-2 text-xs font-medium text-white shadow-[var(--shadow-soft)]">
            Gagal simpan: {saveError}
          </span>
        </div>
      )}
    </div>
  )
}
