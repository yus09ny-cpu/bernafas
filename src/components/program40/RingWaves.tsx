import { useEffect, useRef } from 'react'
import type { BreathPhase } from '@/hooks/useBreathingPacer'
import { BREATH_SCALE_MIN, BREATH_SCALE_MAX, BREATH_EASING } from '@/lib/breathAnimation'

interface RingWavesProps {
  phase: BreathPhase
  phaseDurationMs: number
  size?: number
  ringCount?: number
  color?: string
}

const DEFAULT_RING_COUNT = 3

// One ring's own WAAPI animation — the exact same pattern
// useBreathScaleAnimation.ts uses (fresh two-keyframe `el.animate()` call on
// every phase/duration change, `fill: 'forwards'`, never a live-value-driven
// duration recompute — see that hook's doc comment for why that recompute
// pattern is a known source of visible jank elsewhere in this app), extended
// with a per-ring `delayMs` so the rings ripple outward in sequence instead
// of scaling in lockstep. useBreathScaleAnimation itself has no delay
// param (its callers so far never needed one), hence this local sibling
// rather than changing that shared hook's signature for one caller.
function useRingAnimation(phase: BreathPhase, phaseDurationMs: number, delayMs: number) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = phase === 'in' ? BREATH_SCALE_MIN : BREATH_SCALE_MAX
    const to = phase === 'in' ? BREATH_SCALE_MAX : BREATH_SCALE_MIN
    const anim = el.animate(
      [
        { transform: `scale(${from})`, opacity: 0.45 },
        { transform: `scale(${to})`, opacity: 0.05 },
      ],
      { duration: phaseDurationMs, delay: delayMs, easing: BREATH_EASING, fill: 'forwards' },
    )
    return () => anim.cancel()
  }, [phase, phaseDurationMs, delayMs])
  return ref
}

function Ring({
  phase,
  phaseDurationMs,
  delayMs,
  size,
  color,
}: {
  phase: BreathPhase
  phaseDurationMs: number
  delayMs: number
  size: number
  color: string
}) {
  const ref = useRingAnimation(phase, phaseDurationMs, delayMs)
  return (
    <div
      ref={ref}
      className="absolute rounded-full border-2 will-change-transform"
      style={{ width: size, height: size, borderColor: color }}
    />
  )
}

// Concentric ripple layered around BreathingPulse — same breath rhythm
// (phase/phaseDurationMs), staggered per ring so they read as waves
// expanding outward from the center dot rather than one flat pulse.
// Absolutely positioned + pointer-events-none so it layers behind/around
// BreathingPulse without taking up its own layout space or intercepting
// taps meant for controls underneath.
export default function RingWaves({ phase, phaseDurationMs, size = 260, ringCount = DEFAULT_RING_COUNT, color }: RingWavesProps) {
  const ringColor = color ?? 'var(--color-primary)'
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {Array.from({ length: ringCount }, (_, i) => (
        <Ring
          key={i}
          phase={phase}
          phaseDurationMs={phaseDurationMs}
          delayMs={(phaseDurationMs / ringCount) * i}
          size={size}
          color={ringColor}
        />
      ))}
    </div>
  )
}
