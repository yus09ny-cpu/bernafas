import { ZONE_COLOR } from '@/lib/coherenceZones'
import type { BreathPhase } from '@/hooks/useBreathingPacer'
import { useBreathScaleAnimation } from '@/hooks/useBreathScaleAnimation'

interface FlowerBloomProps {
  coherence: number | null // 0-1, null pre-device/pre-data
  phase: BreathPhase
  phaseDurationMs: number
  size?: number
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

// Continuous red→blue→green interpolation across the coherence zone colors
// (rather than a hard jump at each zone boundary) so the bloom's color
// drifts smoothly as the live score moves — the segmented ring still uses
// the discrete zones (it's a history of *locked-in* samples), but a single
// live bloom reads better as a continuous gradient.
function coherenceToColor(value: number): string {
  const stops = [ZONE_COLOR.low, ZONE_COLOR.medium, ZONE_COLOR.high]
  const scaled = Math.max(0, Math.min(1, value)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(scaled))
  const t = scaled - i
  const a = hexToRgb(stops[i])
  const b = hexToRgb(stops[i + 1])
  return `rgb(${Math.round(lerp(a.r, b.r, t))}, ${Math.round(lerp(a.g, b.g, t))}, ${Math.round(lerp(a.b, b.b, t))})`
}

const PETAL_COUNT = 8

// Animated flower — center content for Skrin 2. Fullness (petal length +
// overall scale) and color both track the live coherence score
// continuously; a breath-synced scale layers on top so it never looks
// static between HRV updates, even pre-device — now the exact same
// WAAPI-driven mechanism as PulseDot's halo/breath-wrapper on Skrin 3 (see
// useBreathScaleAnimation.ts / lib/breathAnimation.ts), not a separate,
// smaller/slower CSS transition of its own. Only the breath *mechanism*
// changed here — petal shape, fullness, and per-zone color are untouched.
export default function FlowerBloom({ coherence, phase, phaseDurationMs, size = 200 }: FlowerBloomProps) {
  const c = coherence ?? 0.15 // gentle idle bud, not full bloom, before real data
  const color = coherenceToColor(c)
  const fullness = 0.45 + c * 0.55 // petal length as a fraction of size
  const center = size / 2
  const petalLength = center * fullness * 0.85
  const petalWidth = petalLength * 0.42

  const breathRef = useBreathScaleAnimation<HTMLDivElement>(phase, phaseDurationMs)

  return (
    <div
      ref={breathRef}
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {Array.from({ length: PETAL_COUNT }, (_, i) => {
          const angle = (360 / PETAL_COUNT) * i
          return (
            <ellipse
              key={i}
              cx={center}
              cy={center - petalLength * 0.55}
              rx={petalWidth}
              ry={petalLength}
              fill={color}
              opacity={0.85}
              transform={`rotate(${angle} ${center} ${center})`}
              style={{ transition: 'rx 700ms ease-out, ry 700ms ease-out, fill 700ms ease-out' }}
            />
          )
        })}
        <circle cx={center} cy={center} r={size * 0.09} fill="#fff8ec" opacity={0.95} />
      </svg>
    </div>
  )
}
