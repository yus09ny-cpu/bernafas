import { useEffect, useRef, useState } from 'react'

export type BreathPhase = 'in' | 'out'

interface UseBreathingPacerOptions {
  // Length of each phase in ms. Default 5000/5000 (~6 breaths/min) is the
  // classic HRV "resonance frequency"/coherence breathing pace used by
  // HeartMath-style pacers and most slow-breathing HRV research — not tied
  // to any specific device, just the physiologically well-supported default.
  inhaleMs?: number
  exhaleMs?: number
  running?: boolean
}

interface BreathingPacerState {
  phase: BreathPhase
  // ms remaining in the current phase, for an optional countdown label.
  msRemaining: number
  // completed inhale+exhale pairs since running went true.
  cycleCount: number
}

const DEFAULT_INHALE_MS = 5000
const DEFAULT_EXHALE_MS = 5000
const TICK_MS = 100

export function useBreathingPacer(options?: UseBreathingPacerOptions): BreathingPacerState {
  const inhaleMs = options?.inhaleMs ?? DEFAULT_INHALE_MS
  const exhaleMs = options?.exhaleMs ?? DEFAULT_EXHALE_MS
  const running = options?.running ?? true

  const [phase, setPhase] = useState<BreathPhase>('in')
  const [msRemaining, setMsRemaining] = useState(inhaleMs)
  const [cycleCount, setCycleCount] = useState(0)

  const phaseRef = useRef<BreathPhase>('in')
  const remainingRef = useRef(inhaleMs)

  useEffect(() => {
    if (!running) return
    // Reset to a clean inhale start whenever the pacer (re)starts.
    phaseRef.current = 'in'
    remainingRef.current = inhaleMs
    setPhase('in')
    setMsRemaining(inhaleMs)

    const id = window.setInterval(() => {
      remainingRef.current -= TICK_MS
      if (remainingRef.current <= 0) {
        if (phaseRef.current === 'in') {
          phaseRef.current = 'out'
          remainingRef.current = exhaleMs
          setPhase('out')
        } else {
          phaseRef.current = 'in'
          remainingRef.current = inhaleMs
          setPhase('in')
          setCycleCount(c => c + 1)
        }
      }
      setMsRemaining(remainingRef.current)
    }, TICK_MS)

    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, inhaleMs, exhaleMs])

  return { phase, msRemaining: Math.max(0, msRemaining), cycleCount }
}
