import { useState } from 'react'
import ConnectScreen from '@/screens/ConnectScreen'
import SessionCarousel from '@/components/session/SessionCarousel'
import DebugOverlay from '@/components/session/DebugOverlay' // TEMP DEBUG — see DebugOverlay.tsx
import { useHrvSession } from '@/hooks/useHrvSession'
import { useBreathingPacer } from '@/hooks/useBreathingPacer'
import { recordSessionCompleted, isUnlockEligible } from '@/lib/unlockBonus'
import type { LiveSessionData } from '@/screens/session/types'

const INHALE_MS = 5000
const EXHALE_MS = 5000

// Session tab — a connect gate in front of the 4-page carousel. Both the
// BLE/HRV stream (useHrvSession) and the breath pacer (useBreathingPacer)
// are owned here, once, and passed down as one LiveSessionData bundle so
// every carousel page (and a future swipe back to Skrin 1 mid-session)
// reads the same live values instead of each re-deriving its own.
export default function SessionScreen() {
  const [started, setStarted] = useState(false)
  const [showUnlockBonus, setShowUnlockBonus] = useState(false)
  const hrv = useHrvSession()
  const pacer = useBreathingPacer({ inhaleMs: INHALE_MS, exhaleMs: EXHALE_MS, running: started })

  const beginSession = () => {
    hrv.startSession()
    setShowUnlockBonus(false)
    setStarted(true)
  }

  const endSession = () => {
    hrv.endSession()
    recordSessionCompleted()
    setShowUnlockBonus(isUnlockEligible())
  }

  const newSession = () => {
    setStarted(false)
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
        onSkip={beginSession}
      />
    )
  }

  const data: LiveSessionData = {
    bpm: hrv.smoothedBpm,
    coherenceLive: hrv.coherenceLive,
    history: hrv.history,
    elapsedSec: hrv.elapsedSec,
    contactLost: hrv.contactLost,
    isDeviceConnected: hrv.state === 'connected',
    sessionActive: hrv.sessionActive,
    phase: pacer.phase,
    phaseDurationMs: pacer.phase === 'in' ? INHALE_MS : EXHALE_MS,
    cycleCount: pacer.cycleCount,
    showUnlockBonus,
  }

  // Ending a session doesn't unmount the carousel — it stops sampling
  // (hrv.sessionActive → false) so Skrin 4 freezes into a summary the user
  // can still swipe/tap back through 1-3 to review. The header button's
  // icon swaps from X to a refresh icon the instant sessionActive flips,
  // and that same icon change is what makes onEndSession safe to repurpose
  // as "start a new session" on the second press.
  return (
    <div className="relative h-full w-full">
      <SessionCarousel data={data} onEndSession={hrv.sessionActive ? endSession : newSession} />
      <DebugOverlay stats={hrv.debugStats} historyLength={hrv.history.length} elapsedSec={hrv.elapsedSec} />
    </div>
  )
}
