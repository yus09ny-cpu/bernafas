import { useBreathScaleAnimation } from '@/hooks/useBreathScaleAnimation'
import BreathPhaseLabel from '@/components/session/BreathPhaseLabel'
import type { BreathPhase } from '@/hooks/useBreathingPacer'

interface BreathingPulseProps {
  phase: BreathPhase
  phaseDurationMs: number
  size?: number
}

// Center dot for the 40-day module's no-device pacer — same
// useBreathScaleAnimation WAAPI mechanism as the Sesi tab's PulseDot/
// FlowerBloom (a fresh two-keyframe animation per phase change, never a
// live-value-driven duration recompute, see that hook's own doc comment),
// not a new animation approach. Label reuses BreathPhaseLabel verbatim
// (same "Tarik Nafas"/"Hembus Nafas" text) — calibrating is always false
// here, there's no live HRV/coherence gate in this no-device path.
export default function BreathingPulse({ phase, phaseDurationMs, size = 130 }: BreathingPulseProps) {
  const ref = useBreathScaleAnimation<HTMLDivElement>(phase, phaseDurationMs)

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        ref={ref}
        className="rounded-full will-change-transform"
        style={{
          width: size,
          height: size,
          background: 'radial-gradient(circle at 34% 28%, #ffffff, var(--color-primary-light)cc 45%, var(--color-primary) 100%)',
          boxShadow: 'var(--shadow-glow)',
        }}
      />
      <BreathPhaseLabel phase={phase} calibrating={false} />
    </div>
  )
}
