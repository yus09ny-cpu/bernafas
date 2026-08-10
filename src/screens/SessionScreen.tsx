import { useState } from 'react'
import ConnectScreen from '@/screens/ConnectScreen'
import SessionCarousel from '@/components/session/SessionCarousel'
import { useHrvSession } from '@/hooks/useHrvSession'
import { useBreathingPacer } from '@/hooks/useBreathingPacer'
import { useZoneDominance } from '@/hooks/useZoneDominance'
import { recordSessionCompleted, isUnlockEligible } from '@/lib/unlockBonus'
import type { LiveSessionData } from '@/screens/session/types'

const INHALE_MS = 5000
const EXHALE_MS = 5000

// Session tab — a connect gate in front of the 4-page carousel. The
// BLE/HRV stream (useHrvSession), the breath pacer (useBreathingPacer), AND
// the zone-dominance ring tally (useZoneDominance) are all owned here,
// once, and passed down as one LiveSessionData bundle so every carousel
// page reads the same live values instead of each re-deriving its own.
// useZoneDominance specifically used to be called separately inside
// Page1Ring.tsx and Page2Mandala.tsx — two independent hook instances,
// each running its own tally off its own effect, which could and did drift
// out of sync with each other. Calling it once here and handing both pages
// the same `zones` array is what actually guarantees they show identical
// ring state at every instant, not just "the same formula."
export default function SessionScreen() {
  const [started, setStarted] = useState(false)
  const [showUnlockBonus, setShowUnlockBonus] = useState(false)
  const hrv = useHrvSession()
  const pacer = useBreathingPacer({ inhaleMs: INHALE_MS, exhaleMs: EXHALE_MS, running: started })
  // Standardized on coherenceLiveAlt (calm-breath-pulse's frequency-domain
  // formula) as the single source driving the ring/flower everywhere it's
  // shown — see the comment on `zones` in types.ts for what's NOT yet
  // switched (Skrin 3/4).
  const zones = useZoneDominance(hrv.elapsedSec, hrv.coherenceLiveAlt)

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
    showUnlockBonus,
    beats: hrv.beats,
    device: hrv.device,
    simulated: hrv.simulated,
    sensorContact: hrv.sensorContact,
    breathCount: pacer.breathCount,
  }

  // Ending a session doesn't unmount the carousel — it stops sampling
  // (hrv.sessionActive → false) so Skrin 4 freezes into a summary the user
  // can still swipe/tap back through 1-3 to review. The header button's
  // icon swaps from X to a refresh icon the instant sessionActive flips,
  // and that same icon change is what makes onEndSession safe to repurpose
  // as "start a new session" on the second press.
  return <SessionCarousel data={data} onEndSession={hrv.sessionActive ? endSession : newSession} />
}
