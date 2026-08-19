import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import DeviceChoicePopup from '@/components/program40/DeviceChoicePopup'
import TechniquePicker from '@/components/program40/TechniquePicker'
import DeviceSessionRunner from '@/screens/program40/DeviceSessionRunner'
import ManualSessionRunner from '@/screens/program40/ManualSessionRunner'
import { resolveDayNumberForToday } from '@/lib/program40/sessions'
import { getAvailableTechniquesForDay, suggestTechniqueForNow, type Program40Technique } from '@/lib/program40/curriculum'
import type { Program40Enrollment } from '@/lib/program40/types'

interface Program40SessionScreenProps {
  userId: string
  enrollment: Program40Enrollment
  // Called once the session is saved, or the user backs all the way out
  // without saving — Program40Hub just re-renders the dashboard either way
  // (a re-fetch there picks up whatever did or didn't get saved).
  onExit: () => void
}

type Mode = 'resolving' | 'technique' | 'choice' | 'device' | 'manual'

// Orchestrates spec items 2+3: day_number is resolved once
// (resolveDayNumberForToday), then TechniquePicker (user correction,
// 2026-08-19 — a day can have several cumulatively-unlocked techniques, so
// this is a real choice, not a lookup), THEN DeviceChoicePopup shown every
// time a new session starts (never skipped/remembered from a prior
// session), then branches to whichever runner matches the device choice.
export default function Program40SessionScreen({ userId, enrollment, onExit }: Program40SessionScreenProps) {
  const [mode, setMode] = useState<Mode>('resolving')
  const [dayNumber, setDayNumber] = useState<number | null>(null)
  const [technique, setTechnique] = useState<Program40Technique | null>(null)

  useEffect(() => {
    let cancelled = false
    resolveDayNumberForToday(userId, enrollment.currentDay).then(({ dayNumber: resolved }) => {
      if (cancelled) return
      setDayNumber(resolved)
      setTechnique(suggestTechniqueForNow(resolved))
      setMode('technique')
    })
    return () => {
      cancelled = true
    }
  }, [userId, enrollment.currentDay])

  if (mode === 'resolving' || dayNumber === null || technique === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  if (mode === 'technique') {
    return (
      <TechniquePicker
        available={getAvailableTechniquesForDay(dayNumber)}
        value={technique}
        onChange={setTechnique}
        onContinue={() => setMode('choice')}
      />
    )
  }

  if (mode === 'device') {
    return <DeviceSessionRunner userId={userId} dayNumber={dayNumber} technique={technique} onDone={onExit} onCancel={() => setMode('choice')} />
  }

  if (mode === 'manual') {
    return <ManualSessionRunner userId={userId} dayNumber={dayNumber} technique={technique} onDone={onExit} onCancel={() => setMode('choice')} />
  }

  return (
    <div className="h-full w-full">
      <DeviceChoicePopup
        open
        onChooseDevice={() => setMode('device')}
        onChooseManual={() => setMode('manual')}
        onCancel={onExit}
      />
    </div>
  )
}
