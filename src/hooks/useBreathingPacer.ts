import { useEffect, useState } from 'react'

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
  // completed inhale+exhale pairs since running went true.
  cycleCount: number
  // Length of the *current* phase in ms — needed by calm-breath-pulse's
  // ported PulsingSphere (Skrin 1) to size its WAAPI breath cycle. Existing
  // callers (SessionScreen.tsx) already compute this themselves from
  // phase+inhaleMs/exhaleMs; this is just that same derivation surfaced on
  // the hook's own return value so a new consumer doesn't need to duplicate it.
  phaseDurationMs: number
  // 1-indexed "current breath number" (cycleCount + 1) — same value
  // Page1Ring.tsx already displayed as `cycleCount + 1`, now named to match
  // what the ported PulsingSphere/footer code expects.
  breathCount: number
}

const DEFAULT_INHALE_MS = 5000
const DEFAULT_EXHALE_MS = 5000

// One setTimeout per phase, self-rescheduling on each transition — fires
// exactly twice per cycle (once per phase boundary), not on a fixed poll.
// A prior 100ms-poll version (setInterval + a since-removed msRemaining
// countdown nothing ever displayed) re-rendered every consumer of this hook
// 10x/sec unconditionally, confirmed via profiling as a real, wasteful
// render-rate floor — see PulseDot's breath-sync investigation. This
// version produces exactly 2 state updates per 10s cycle (at the default
// 5s/5s pace) instead of 100.
export function useBreathingPacer(options?: UseBreathingPacerOptions): BreathingPacerState {
  const inhaleMs = options?.inhaleMs ?? DEFAULT_INHALE_MS
  const exhaleMs = options?.exhaleMs ?? DEFAULT_EXHALE_MS
  const running = options?.running ?? true

  const [phase, setPhase] = useState<BreathPhase>('in')
  const [cycleCount, setCycleCount] = useState(0)

  useEffect(() => {
    if (!running) return
    // Reset to a clean inhale start whenever the pacer (re)starts.
    setPhase('in')

    // Local to this effect run (not a ref) — safe because every mutation
    // and read happens inside this same closure chain, never across
    // renders; the effect only re-runs when running/inhaleMs/exhaleMs
    // change, at which point cleanup below tears the whole chain down.
    let currentPhase: BreathPhase = 'in'
    let timeoutId: number

    const scheduleNext = () => {
      const duration = currentPhase === 'in' ? inhaleMs : exhaleMs
      timeoutId = window.setTimeout(() => {
        if (currentPhase === 'in') {
          currentPhase = 'out'
          setPhase('out')
        } else {
          currentPhase = 'in'
          setPhase('in')
          setCycleCount(c => c + 1)
        }
        scheduleNext()
      }, duration)
    }
    scheduleNext()

    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, inhaleMs, exhaleMs])

  return {
    phase,
    cycleCount,
    phaseDurationMs: phase === 'in' ? inhaleMs : exhaleMs,
    breathCount: cycleCount + 1,
  }
}
