import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ZONE_COLOR, type CoherenceZone } from '@/lib/coherenceZones'
import type { BreathPhase } from '@/hooks/useBreathingPacer'
import { useBreathScaleAnimation } from '@/hooks/useBreathScaleAnimation'

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

// Idle tick pace used whenever there's no reading yet (bpm === null) — see
// "No reading yet" below.
const IDLE_BPM = 12

// Ramp-in guard for the idle -> contact transition. When a finger first
// makes contact, bpm flips from null straight to smoothedBpm's very first
// post-contact value — and BpmSmoother's window is reset to empty on every
// contact loss (useHrvSession.ts), so that first value is effectively
// unsmoothed (a window of one sample). Feeding it straight into
// updatePlaybackRate() jumps the heartbeat tick's speed from the idle rate
// (IDLE_BPM/BASE_BPM = 0.2x) to a real-bpm rate (often ~1x+) in a single
// step — a real, visible speed jerk right at the moment contact begins,
// separate from (and not fixed by) the earlier duration-recompute bug fix.
// This ramps the playback rate smoothly from the idle rate to the new
// target over IDLE_TO_CONTACT_RAMP_MS instead of snapping it in one frame.
// 2500ms is a first guess — long enough to span a couple of real packets at
// typical BLE cadence (~1/beat) so the smoother has caught up by the time
// the ramp ends, short enough not to read as sluggish. Revisit once real
// [bpm-feed] data (see useHrvSession.ts) shows actual post-contact packet
// timing/noise.
const IDLE_TO_CONTACT_RAMP_MS = 2500

// Center dot for Skrin 3 (scene) — synced to *two* independent rhythms at
// once: the slow breath phase (scale, same expand-on-inhale/contract-on-
// exhale as BreathOrb, and now the same shared mechanism FlowerBloom on
// Skrin 2 uses — see useBreathScaleAnimation.ts / lib/breathAnimation.ts)
// and the fast heartbeat (a quick brightness/scale "tick" once per beat,
// timed off the live BPM). zone is null pre-device/pre-data and falls back
// to the brand teal rather than a zone color, since there's no live
// coherence yet to color it by.
//
// The two rhythms live on two *nested* elements, not one: a running WAAPI
// animation fully overrides an element's `transform` for as long as it's
// active, so a single div can't carry both the breath's scale and the
// heartbeat's keyframe scale at once. The outer wrapper below owns the slow
// breath animation; the sphere inside it owns the fast heartbeat animation;
// nested transforms compose visually, so the sphere visibly does both at once.
export default function PulseDot({ phase, phaseDurationMs, bpm, zone, size = 120, className }: PulseDotProps) {
  const color = zone ? ZONE_COLOR[zone] : '#3e9c9c'
  const sphereSize = size * 0.56

  // 1.4/0.7 scale range, easeInOutSine curve — shared with FlowerBloom, see
  // lib/breathAnimation.ts for the tuning history behind these numbers.
  const haloRef = useBreathScaleAnimation<HTMLDivElement>(phase, phaseDurationMs)
  const breathWrapperRef = useBreathScaleAnimation<HTMLDivElement>(phase, phaseDurationMs)

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
  const effectiveBpm = bpm ?? IDLE_BPM

  // Tracks whether the *previous* render had no reading (bpm === null), so
  // the ramp-in guard below fires exactly on the idle->contact edge and
  // never on ordinary bpm-to-bpm updates while contact is already held.
  const wasIdleRef = useRef(true)
  const rampFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const anim = heartbeatAnimationRef.current
    if (!anim) return

    const cameFromIdle = wasIdleRef.current && bpm !== null
    wasIdleRef.current = bpm === null

    if (rampFrameRef.current !== null) {
      cancelAnimationFrame(rampFrameRef.current)
      rampFrameRef.current = null
    }

    const targetRate = effectiveBpm / BASE_BPM

    if (!cameFromIdle) {
      // Ordinary update (already in contact, or the very first idle tick) —
      // no known jump to guard against, snap as before. Whether *this* path
      // also needs damping for ongoing per-packet noise is a separate,
      // still-open question pending real [bpm-feed] hardware data.
      anim.updatePlaybackRate(targetRate)
      return
    }

    // Idle -> contact: ease the rate over from wherever it currently sits
    // instead of snapping straight to the new target.
    const fromRate = Number(anim.playbackRate ?? IDLE_BPM / BASE_BPM)
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / IDLE_TO_CONTACT_RAMP_MS)
      const eased = t * t * (3 - 2 * t) // smoothstep — gentle at both ends
      anim.updatePlaybackRate(fromRate + (targetRate - fromRate) * eased)
      rampFrameRef.current = t < 1 ? requestAnimationFrame(step) : null
    }
    rampFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (rampFrameRef.current !== null) {
        cancelAnimationFrame(rampFrameRef.current)
        rampFrameRef.current = null
      }
    }
  }, [bpm, effectiveBpm])

  return (
    <div className={cn('relative flex items-center justify-center', className)} style={{ width: size, height: size }}>
      {/* Halo — slow, large expand/contract, kept for the depth it adds behind the sphere */}
      <div
        ref={haloRef}
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at center, ${color}33, ${color}08 70%, transparent 80%)`,
          willChange: 'transform',
        }}
      />
      {/* Breath wrapper — same slow scale as the halo, sized to the sphere */}
      <div
        ref={breathWrapperRef}
        className="absolute rounded-full"
        style={{
          width: sphereSize,
          height: sphereSize,
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
