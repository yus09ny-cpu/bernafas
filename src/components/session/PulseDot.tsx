import { useEffect, useRef } from 'react'
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

// Reference pace the sphere's single long-running WAAPI heartbeat animation
// is authored at — live bpm changes scale *playback rate* relative to this,
// never the animation's own duration. Same fix, same reason, as
// PulseWaveform: this used to be a CSS `animation` whose duration was
// recomputed from live bpm on every render (bpm updates on ~every BLE
// packet); changing a running CSS animation's duration preserves its
// elapsed-time clock but reinterprets that same elapsed time against the
// *new* duration, snapping the visible scale on every bpm update. Verified
// empirically before this fix: worst case found sweeping a 68->90bpm swing
// across the full cycle was a 0.12 scale-unit jump (scale 1.00 -> 1.12,
// i.e. the *entire* intended animation amplitude) with ~0ms real time
// elapsed — worse than the waveform's version of the bug, since this
// keyframe is mostly flat with a brief spike, so a bad re-anchor can pop
// the spike fully in or out in one frame instead of just repositioning
// along a continuous sweep.
const BASE_BPM = 60
const BASE_BEAT_DURATION_MS = (60 / BASE_BPM) * 1000

// Center dot for Skrin 1 (ring) — synced to *two* independent rhythms at
// once: the slow breath phase (scale, same expand-on-inhale/contract-on-
// exhale as BreathOrb) and the fast heartbeat (a quick brightness/scale
// "tick" once per beat, timed off the live BPM). zone is null pre-device/
// pre-data and falls back to the brand teal rather than a zone color, since
// there's no live coherence yet to color it by.
//
// The two rhythms live on two *nested* elements, not one: a running CSS
// `animation`/WAAPI animation fully overrides an element's `transform` for
// as long as it's active, so a single div can't carry both the breath's
// transition-based scale and the heartbeat's keyframe-based scale at once.
// The outer wrapper below owns the slow breath transform; the sphere inside
// it owns the fast heartbeat animation; nested transforms compose visually,
// so the sphere visibly does both at once.
export default function PulseDot({ phase, phaseDurationMs, bpm, zone, size = 120, className }: PulseDotProps) {
  // 1.4/0.7 — final value. History: 1.15/0.88 was confirmed *correct*
  // (computed transform genuinely oscillates) but too subtle to notice;
  // 1.25/0.85 was still too subtle on real hardware, which turned out to be
  // a red herring — a real bug (useBreathingPacer's 100ms poll forcing a
  // ~10Hz unconditional re-render floor, since fixed) was the actual cause,
  // confirmed via a deliberately extreme 2.2/0.4 pushed to production,
  // clearly visible. Dialed back to this range as noticeable-but-not-
  // exaggerated once the underlying mechanism was proven sound end to end.
  const breathScale = phase === 'in' ? 1.4 : 0.7
  const color = zone ? ZONE_COLOR[zone] : '#3e9c9c'
  const sphereSize = size * 0.56

  const sphereRef = useRef<HTMLDivElement>(null)
  const heartbeatAnimationRef = useRef<Animation | null>(null)

  // Created once and never recreated or re-durationed — bpm changes only
  // ever call updatePlaybackRate() on this same instance (next effect).
  useEffect(() => {
    const el = sphereRef.current
    if (!el) return
    const animation = el.animate(
      [
        { transform: 'scale(1)', offset: 0 },
        { transform: 'scale(1.12)', offset: 0.12 },
        { transform: 'scale(1)', offset: 0.24 },
        { transform: 'scale(1)', offset: 1 },
      ],
      { duration: BASE_BEAT_DURATION_MS, iterations: Infinity, easing: 'ease-in-out' },
    )
    heartbeatAnimationRef.current = animation
    return () => animation.cancel()
  }, [])

  // No reading yet: keep a slow idle tick alive rather than a static dot.
  const effectiveBpm = bpm ?? 12
  useEffect(() => {
    heartbeatAnimationRef.current?.updatePlaybackRate(effectiveBpm / BASE_BPM)
  }, [effectiveBpm])

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
          ref={sphereRef}
          className="h-full w-full rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 30%, #ffffff, ${color}cc 45%, ${color} 100%)`,
            boxShadow: `0 6px 24px ${color}40`,
          }}
        />
      </div>
    </div>
  )
}
