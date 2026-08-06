import { cn } from '@/lib/utils'
import type { BreathPhase } from '@/hooks/useBreathingPacer'

interface BreathOrbProps {
  phase: BreathPhase
  // Transition duration should match the pacer's phase length so the visual
  // expand/contract lands exactly on the next phase change.
  durationMs: number
  size?: number
  className?: string
}

// Pastel blue → mint radial orb that expands on inhale, contracts on exhale.
// Pure presentational — the caller (useBreathingPacer) owns all timing.
export default function BreathOrb({ phase, durationMs, size = 240, className }: BreathOrbProps) {
  const scale = phase === 'in' ? 1.28 : 0.74

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {/* Soft outer halo, one step behind the core orb for depth */}
      <div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          transform: `scale(${scale})`,
          transition: `transform ${durationMs}ms cubic-bezier(0.45, 0, 0.55, 1)`,
          background: 'radial-gradient(circle at center, rgba(111,195,189,0.35), rgba(111,168,220,0.08) 70%, transparent 80%)',
          willChange: 'transform',
        }}
      />
      {/* Core orb */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          transform: `scale(${scale})`,
          transition: `transform ${durationMs}ms cubic-bezier(0.45, 0, 0.55, 1)`,
          background: 'radial-gradient(circle at 35% 30%, #ffffff, #a9ded8 45%, #6fa8dc 100%)',
          boxShadow: '0 8px 30px rgba(63,140,140,0.25)',
          willChange: 'transform',
        }}
      />
    </div>
  )
}
