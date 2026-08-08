import { cn } from '@/lib/utils'
import { ZONE_COLOR, type CoherenceZone } from '@/lib/coherenceZones'
import type { BreathPhase } from '@/hooks/useBreathingPacer'

interface PulseDotProps {
  phase: BreathPhase
  phaseDurationMs: number
  bpm: number | null
  zone: CoherenceZone | null
  size?: number
  className?: string
}

// Center dot for Skrin 1 (ring) — synced to *two* independent rhythms at
// once: the slow breath phase (scale, same expand-on-inhale/contract-on-
// exhale as BreathOrb) and the fast heartbeat (a quick brightness/scale
// "tick" once per beat, timed off the live BPM). zone is null pre-device/
// pre-data and falls back to the brand teal rather than a zone color, since
// there's no live coherence yet to color it by.
export default function PulseDot({ phase, phaseDurationMs, bpm, zone, size = 120, className }: PulseDotProps) {
  const breathScale = phase === 'in' ? 1.15 : 0.88
  const color = zone ? ZONE_COLOR[zone] : '#3e9c9c'
  // No reading yet: keep a slow idle tick alive rather than a static dot.
  const beatDurationSec = 60 / (bpm ?? 12)

  return (
    <div className={cn('relative flex items-center justify-center', className)} style={{ width: size, height: size }}>
      {/* Breath layer — slow, large expand/contract */}
      <div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          transform: `scale(${breathScale})`,
          transition: `transform ${phaseDurationMs}ms cubic-bezier(0.45, 0, 0.55, 1)`,
          background: `radial-gradient(circle at center, ${color}33, ${color}08 70%, transparent 80%)`,
          willChange: 'transform',
        }}
      />
      {/* Heartbeat layer — fast, small tick once per beat */}
      <div
        className="absolute rounded-full"
        style={{
          width: size * 0.56,
          height: size * 0.56,
          background: `radial-gradient(circle at 35% 30%, #ffffff, ${color}cc 45%, ${color} 100%)`,
          boxShadow: `0 6px 24px ${color}40`,
          animation: `bernafas-heartbeat ${beatDurationSec}s ease-in-out infinite`,
        }}
      />
      <style>{`
        @keyframes bernafas-heartbeat {
          0%   { transform: scale(1); }
          12%  { transform: scale(1.12); }
          24%  { transform: scale(1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
