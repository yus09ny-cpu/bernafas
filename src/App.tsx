import { useState } from 'react'
import ConnectScreen from '@/screens/ConnectScreen'
import BreathingScreen from '@/screens/BreathingScreen'
import SummaryScreen from '@/screens/SummaryScreen'
import { useHrvSession, type SessionSummary } from '@/hooks/useHrvSession'
import { recordSessionCompleted, isUnlockEligible } from '@/lib/unlockBonus'

type Screen = 'connect' | 'breathing' | 'summary'

export default function App() {
  const [screen, setScreen] = useState<Screen>('connect')
  const [lastSummary, setLastSummary] = useState<SessionSummary | null>(null)
  const [lastBreathCount, setLastBreathCount] = useState(0)
  const [showUnlockBonus, setShowUnlockBonus] = useState(false)
  const hrv = useHrvSession()

  const beginSession = () => {
    hrv.startSession()
    setScreen('breathing')
  }

  const endSession = (breathCount: number) => {
    const summary = hrv.endSession()
    recordSessionCompleted()
    setLastSummary(summary)
    setLastBreathCount(breathCount)
    setShowUnlockBonus(isUnlockEligible())
    setScreen('summary')
  }

  if (screen === 'summary' && lastSummary) {
    return (
      <SummaryScreen
        summary={lastSummary}
        breathCount={lastBreathCount}
        showUnlockBonus={showUnlockBonus}
        onNewSession={() => setScreen('connect')}
      />
    )
  }

  if (screen === 'breathing') {
    return (
      <BreathingScreen
        bpm={hrv.smoothedBpm}
        coherenceLive={hrv.coherenceLive}
        isDeviceConnected={hrv.state === 'connected'}
        onEnd={endSession}
      />
    )
  }

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
