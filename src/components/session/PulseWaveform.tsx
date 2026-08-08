import { useMemo } from 'react'
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

export default function PulseWaveform({ bpm, color = '#3e9c9c', className }: PulseWaveformProps) {
  const path = useMemo(
    () =>
      Array.from({ length: REPEATS * 2 }, (_, i) =>
        UNIT_PATH.replace(/(-?\d+(?:\.\d+)?),/g, (_m, n) => `${Number(n) + i * UNIT_WIDTH},`),
      ).join(' '),
    [],
  )

  // 60bpm → one blip/sec. No reading yet: fall back to a slow idle pace
  // rather than freezing, so the strip still reads as "alive" pre-connect.
  const effectiveBpm = bpm ?? 12
  const loopDurationSec = (REPEATS * 60) / effectiveBpm

  return (
    <div className={cn('relative mx-auto h-10 w-full overflow-hidden', className)}>
      <svg
        viewBox={`0 0 ${UNIT_WIDTH * REPEATS} 60`}
        preserveAspectRatio="none"
        className="absolute inset-y-0 left-0 h-full"
        style={{
          width: `${REPEATS * 2 * 100}%`,
          animation: `bernafas-pulse-scroll ${loopDurationSec}s linear infinite`,
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
      <style>{`
        @keyframes bernafas-pulse-scroll {
          from { transform: translateX(0); }
          /* SVG element is REPEATS*2 units wide (path repeated twice); shifting
             left by half its own rendered width = exactly one REPEATS-wide
             cycle, so the second half lines up pixel-for-pixel with where the
             first half started — a seamless loop regardless of container size. */
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
