import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ZONE_COLOR, type CoherenceZone } from '@/lib/coherenceZones'
import type { BreathPhase } from '@/hooks/useBreathingPacer'
import { reportPulseDotRender } from '@/lib/pulseDotDebugBus' // TEMP DEBUG

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
//
// The two rhythms live on two *nested* elements, not one: a running CSS
// `animation` fully overrides an element's `transform` for as long as it's
// active, so a single div can't carry both the breath's transition-based
// scale and the heartbeat's keyframe-based scale at once — whichever is the
// `animation` would silently win and mask the other. The outer wrapper
// below owns the slow breath transform; the sphere inside it owns the fast
// heartbeat keyframe; nested transforms compose visually, so the sphere
// visibly does both at once.
export default function PulseDot({ phase, phaseDurationMs, bpm, zone, size = 120, className }: PulseDotProps) {
  // TEMP EXTREME — 2.2/0.4, deliberately impossible-to-miss. Pushed to
  // production specifically to isolate "is the breath-scale mechanism
  // reaching the screen on bernafas.my at all" from "is 1.25/0.85 just too
  // subtle to notice" — the normal range (1.25/0.85, confirmed correct via
  // computed-style polling both locally and on a prior production check)
  // resumes once that question is answered. See pulseDotDebugBus.ts-era
  // investigation for the verification history this follows on from.
  const breathScale = phase === 'in' ? 2.2 : 0.4
  // TEMP DEBUG — report the *actual* values this render computed, every
  // single render (no dep array), so DebugOverlay shows real runtime state
  // rather than a value recomputed/guessed at elsewhere. See pulseDotDebugBus.ts.
  useEffect(() => {
    reportPulseDotRender(phase, breathScale)
  })
  const color = zone ? ZONE_COLOR[zone] : '#3e9c9c'
  // No reading yet: keep a slow idle tick alive rather than a static dot.
  const beatDurationSec = 60 / (bpm ?? 12)
  const sphereSize = size * 0.56

  return (
    <div className={cn('relative flex items-center justify-center', className)} style={{ width: size, height: size }}>
      {/* Halo — slow, large expand/contract, kept for the depth it adds behind the sphere */}
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
      {/* Breath wrapper — same slow scale as the halo, sized to the sphere */}
      <div
        className="absolute rounded-full"
        style={{
          width: sphereSize,
          height: sphereSize,
          transform: `scale(${breathScale})`,
          transition: `transform ${phaseDurationMs}ms cubic-bezier(0.45, 0, 0.55, 1)`,
          willChange: 'transform',
        }}
      >
        {/* Sphere — fast, small heartbeat tick once per beat, nested inside the breath wrapper */}
        <div
          className="h-full w-full rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 30%, #ffffff, ${color}cc 45%, ${color} 100%)`,
            boxShadow: `0 6px 24px ${color}40`,
            animation: `bernafas-heartbeat ${beatDurationSec}s ease-in-out infinite`,
          }}
        />
      </div>
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
