// Ported verbatim from calm-breath-pulse's src/components/session/PulsingSphere.tsx
// for Skrin 1 — the WAAPI breath-scale + heartbeat-tick + drift-correction
// logic below is copied as-is, unedited. `phase`/`phaseDurationMs`/`bpm` are
// driven by Bernafas's real useBreathingPacer/useHrvSession data (see
// Page1Ring.tsx), never the source repo's own mock hooks.
import { useEffect, useRef } from 'react'
import type { BreathPhase } from '@/hooks/useBreathingPacer'

/**
 * Two independent layers:
 *  - outer: slow breath-synced scale (driven by phase changes only)
 *  - inner: fast heartbeat tick, created ONCE and re-rated via
 *    updatePlaybackRate() so live bpm updates never restart/snap it.
 */
export function PulsingSphere({
  phase,
  phaseDurationMs,
  bpm,
  smoothness = 1,
  color,
  size = 144,
}: {
  phase: BreathPhase
  phaseDurationMs: number
  bpm: number
  /** 0 = linear/sharp turnaround, 1 = sine, >1 = long eased pauses at the ends. */
  smoothness?: number
  /**
   * Sphere diameter in px — NOT part of the original calm-breath-pulse
   * component (fixed at 144px/size-36 there). Added so the sphere scales
   * together with SegmentedRing's own `size` prop under Skrin 1's
   * ring-size setting (see useRingSize.ts) instead of staying a constant
   * size while the ring around it grows/shrinks. Defaults to the original
   * 144px so every other caller is pixel-identical to before.
   */
  size?: number
  /**
   * NOT part of the original calm-breath-pulse component — its own
   * `--gradient-sphere`/`--gradient-sheen` tokens are a fixed teal-blue
   * regardless of any score, by design (verified against the source repo;
   * it never wired coherence into this component at all). Bernafas's own
   * PulseDot *did* zone-color its sphere, and that's the behavior this app
   * actually needs, so this prop was added post-port to close that gap.
   * Falls back to the source's own fixed teal when omitted (no reading yet).
   */
  color?: string
}) {
  const breathRef = useRef<HTMLDivElement>(null)
  const beatRef = useRef<HTMLDivElement>(null)
  const beatAnimRef = useRef<Animation | null>(null)
  const breathAnimRef = useRef<Animation | null>(null)

  // Breath scale: ONE continuous sinusoidal cycle for the whole session, so
  // inhale flows into exhale with no restart, no easing reset, no velocity jump
  // at the turnaround. Phase changes only nudge it back into sync if it drifts.
  useEffect(() => {
    const el = breathRef.current
    if (!el) return
    const MIN = 0.7
    const MAX = 1.4
    const STEPS = 60 // sampled curve -> smooth accel/decel with linear playback
    const s = Math.min(2, Math.max(0, smoothness))
    const frames = Array.from({ length: STEPS + 1 }, (_, i) => {
      const p = i / STEPS // 0 = start of inhale, 0.5 = peak, 1 = back to floor
      const triangle = 1 - Math.abs(2 * p - 1) // sharp turnarounds
      const sine = (1 - Math.cos(p * Math.PI * 2)) / 2 // natural ease
      // 0..1 blends linear -> sine; 1..2 adds smoothstep for longer, softer
      // pauses at the top of the inhale and the bottom of the exhale.
      const base = s <= 1 ? triangle + (sine - triangle) * s : sine
      const extra = s <= 1 ? 0 : s - 1
      const smoothed = base * base * (3 - 2 * base)
      const eased = base + (smoothed - base) * extra
      return {
        transform: `scale(${(MIN + (MAX - MIN) * eased).toFixed(4)})`,
        offset: p,
      }
    })
    // Preserve playback position so changing the setting mid-breath never snaps.
    const prevTime = Number(breathAnimRef.current?.currentTime ?? 0)
    const anim = el.animate(frames, {
      duration: phaseDurationMs * 2,
      iterations: Infinity,
      easing: 'linear',
    })
    anim.currentTime = prevTime % (phaseDurationMs * 2)
    breathAnimRef.current = anim
    return () => {
      anim.cancel()
      breathAnimRef.current = null
    }
  }, [phaseDurationMs, smoothness])

  // Keep the loop aligned with the pacer without ever restarting it: if the
  // cycle has drifted from the phase boundary, ease the position back.
  useEffect(() => {
    const anim = breathAnimRef.current
    if (!anim) return
    const cycle = phaseDurationMs * 2
    const target = phase === 'in' ? 0 : phaseDurationMs
    const current = Number(anim.currentTime ?? 0) % cycle
    let drift = current - target
    if (drift > cycle / 2) drift -= cycle
    if (drift < -cycle / 2) drift += cycle
    // Only correct meaningful drift, and correct gradually via playback rate
    // so the sphere never teleports mid-breath.
    if (Math.abs(drift) < 120) return
    const correctionWindow = phaseDurationMs
    const rate = Math.min(1.25, Math.max(0.75, 1 - drift / correctionWindow))
    anim.updatePlaybackRate(rate)
    const id = window.setTimeout(() => anim.updatePlaybackRate(1), correctionWindow)
    return () => window.clearTimeout(id)
  }, [phase, phaseDurationMs])

  // Heartbeat tick: one animation for the whole session.
  useEffect(() => {
    const el = beatRef.current
    if (!el) return
    const anim = el.animate(
      [
        { transform: 'scale(1)', offset: 0 },
        { transform: 'scale(1.07)', offset: 0.12 },
        { transform: 'scale(0.985)', offset: 0.28 },
        { transform: 'scale(1)', offset: 1 },
      ],
      { duration: 1000, iterations: Infinity, easing: 'ease-out' },
    )
    beatAnimRef.current = anim
    return () => anim.cancel()
  }, [])

  useEffect(() => {
    const safeBpm = Math.min(200, Math.max(30, bpm || 60))
    beatAnimRef.current?.updatePlaybackRate(safeBpm / 60)
  }, [bpm])

  // Source repo's own fixed default — kept as the pre-reading fallback so
  // "no zone yet" still looks intentional rather than uncolored.
  const sphereColor = color ?? '#3e9c9c'

  return (
    <div ref={breathRef} className="will-change-transform">
      <div ref={beatRef} className="will-change-transform">
        <div
          className="rounded-full shadow-[var(--shadow-glow)]"
          style={{
            width: size,
            height: size,
            // Same 3-stop recipe/highlight position as the source repo's
            // --gradient-sphere, just recolored per zone instead of fixed —
            // same white->color->color shape PulseDot.tsx already uses
            // elsewhere in the app, for a consistent zone-color language.
            background: `radial-gradient(circle at 34% 28%, #ffffff, ${sphereColor}cc 45%, ${sphereColor} 100%)`,
            transition: 'background 600ms ease-out',
          }}
        >
          <div
            className="size-full rounded-full"
            style={{ background: 'radial-gradient(circle at 70% 78%, rgba(255,255,255,0.35) 0%, transparent 55%)' }}
          />
        </div>
      </div>
    </div>
  )
}
