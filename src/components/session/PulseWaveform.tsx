import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'

interface PulseWaveformProps {
  bpm: number | null
  color?: string
  className?: string
}

// One stylized heartbeat "blip" — flat baseline, a sharp up-down spike, flat
// again. Not raw PPG: the heart_rate BLE GATT service only ever hands us BPM
// + R-R intervals, never a sampled waveform, so there is no real sensor
// trace to draw. This is a rhythm strip in the HeartMath/Inner Balance sense
// — its *timing* is real (one blip per beat, spaced at the live BPM's
// period), its *shape* is illustrative.
const UNIT_WIDTH = 50
const UNIT_PATH =
  'M0,30 L16,30 L20,10 L24,50 L28,16 L32,30 L50,30'
const REPEATS = 8

// Reference pace the single long-running WAAPI animation is authored at —
// live bpm changes scale *playback rate* relative to this, never the
// animation's own duration. Previously this was a CSS `animation` whose
// duration was recomputed from live bpm on every render (bpm updates on
// ~every BLE packet, roughly 1/sec on real hardware); changing a running
// CSS animation's duration preserves its elapsed-time clock but
// reinterprets that same elapsed time against the *new* duration, which
// snaps the visible scroll position on every bpm update — confirmed
// empirically: a 68->90bpm swing mid-animation produced a 101px jump with
// ~0ms of real time elapsed between the before/after reads. Animation.
// updatePlaybackRate() instead smoothly changes speed from wherever the
// animation currently is, with no re-anchoring — see the effect below.
const BASE_BPM = 60
const BASE_LOOP_DURATION_MS = ((REPEATS * 60) / BASE_BPM) * 1000

// Strict "one blip-width per real beat-interval" pacing (rate = bpm/BASE_BPM
// with no further scaling) read as too fast/busy — this scales playback
// rate down uniformly, so relative pacing across different bpms is
// preserved (a faster heart rate still visibly scrolls faster than a
// slower one), just calmer overall. Tune this one constant to retime the
// whole strip; nothing else needs to change.
const SCROLL_SPEED_FACTOR = 0.5

export default function PulseWaveform({ bpm, color = '#3e9c9c', className }: PulseWaveformProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const animationRef = useRef<Animation | null>(null)

  const path = useMemo(
    () =>
      Array.from({ length: REPEATS * 2 }, (_, i) =>
        UNIT_PATH.replace(/(-?\d+(?:\.\d+)?),/g, (_m, n) => `${Number(n) + i * UNIT_WIDTH},`),
      ).join(' '),
    [],
  )

  // Created once and never recreated or re-durationed — bpm changes only
  // ever call updatePlaybackRate() on this same instance (next effect).
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const animation = el.animate(
      // SVG element is REPEATS*2 units wide (path repeated twice); shifting
      // left by half its own rendered width = exactly one REPEATS-wide
      // cycle, so the second half lines up pixel-for-pixel with where the
      // first half started — a seamless loop regardless of container size.
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }],
      { duration: BASE_LOOP_DURATION_MS, iterations: Infinity, easing: 'linear' },
    )
    animationRef.current = animation
    return () => animation.cancel()
  }, [])

  // No reading yet: keep a slow idle tick alive rather than a static dot.
  const effectiveBpm = bpm ?? 12
  useEffect(() => {
    animationRef.current?.updatePlaybackRate((effectiveBpm / BASE_BPM) * SCROLL_SPEED_FACTOR)
  }, [effectiveBpm])

  return (
    <div className={cn('relative mx-auto h-10 w-full overflow-hidden', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${UNIT_WIDTH * REPEATS} 60`}
        preserveAspectRatio="none"
        className="absolute inset-y-0 left-0 h-full"
        style={{
          width: `${REPEATS * 2 * 100}%`,
          opacity: bpm !== null ? 0.9 : 0.35,
        }}
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Fade the strip's edges so blips scroll in/out softly instead of clipping hard. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, var(--strip-fade-bg, transparent) 0%, transparent 8%, transparent 92%, var(--strip-fade-bg, transparent) 100%)',
        }}
      />
    </div>
  )
}
