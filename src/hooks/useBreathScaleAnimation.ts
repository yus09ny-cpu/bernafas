import { useEffect, useRef } from 'react'
import type { BreathPhase } from './useBreathingPacer'
import { BREATH_SCALE_MIN, BREATH_SCALE_MAX, BREATH_EASING } from '@/lib/breathAnimation'

// Drives one element's `transform: scale()` through the shared breath-scale
// WAAPI animation — finalized on Skrin 1's PulseDot, extracted here so every
// breath-synced visual that wants it (PulseDot's halo + breath-wrapper,
// FlowerBloom) shares one exact implementation instead of hand-rolling its
// own copy that can drift out of sync.
//
// A fresh two-keyframe animation is started on every phase flip rather than
// one long-running animation re-rated via updatePlaybackRate (unlike the
// bpm/heartbeat-driven animations elsewhere in this codebase) — breathScale
// only ever has two possible values and flips at most twice per breath
// cycle, so there's no continuously-changing driver value for the
// recompute-duration-on-every-render bug (see PulseDot's/PulseWaveform's own
// notes) to apply to. `fill: 'forwards'` holds the end value once the
// animation completes, same as a CSS transition settling at its target.
export function useBreathScaleAnimation<T extends HTMLElement>(phase: BreathPhase, phaseDurationMs: number) {
  const ref = useRef<T>(null)
  const animRef = useRef<Animation | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = phase === 'in' ? BREATH_SCALE_MIN : BREATH_SCALE_MAX
    const to = phase === 'in' ? BREATH_SCALE_MAX : BREATH_SCALE_MIN
    animRef.current?.cancel()
    animRef.current = el.animate([{ transform: `scale(${from})` }, { transform: `scale(${to})` }], {
      duration: phaseDurationMs,
      easing: BREATH_EASING,
      fill: 'forwards',
    })
    return () => animRef.current?.cancel()
  }, [phase, phaseDurationMs])

  return ref
}
