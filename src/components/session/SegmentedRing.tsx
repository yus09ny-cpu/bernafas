// Skrin 1's ring — redesigned from a time-locked history dial into a
// HeartMath Inner Balance–style "zone dominance" ring: 36 ticks, grouped
// into three contiguous arcs (red/blue/green) sized by how much of the
// session-so-far has been spent in each coherence zone, not by *when* each
// tick was reached. The live tally that produces the `zones` array below
// lives in Page1Ring.tsx (useZoneDominance) — this component only knows how
// to lay out whatever zones[] it's handed as 36 ticks with a bigger gap at
// each of the (up to three) zone-group boundaries and a small gap between
// ticks of the same zone, so same-zone runs read as one solid arc.
//
// NOT shared with Skrin 3 — Page3Mandala.tsx uses the separate, untouched
// SegmentedCoherenceRing.tsx (Bernafas's own original time-locked ring).
// This file only ever backs Skrin 1's Page1Ring.
import { ZONE_COLOR, type CoherenceZone } from '@/lib/coherenceZones'

export const SEGMENT_COUNT = 36

export type Zone = CoherenceZone | 'idle'

// Matches the "no data yet" track color the app's older
// SegmentedCoherenceRing (Skrin 2/3) already uses, for visual continuity.
const TRACK_COLOR = '#d7e3e1'

const ZONE_FILL: Record<Zone, string> = {
  idle: TRACK_COLOR,
  low: ZONE_COLOR.low,
  medium: ZONE_COLOR.medium,
  high: ZONE_COLOR.high,
}

// Small gap between two ticks that belong to the SAME zone (keeps a hint of
// individual "tick" texture without visually fragmenting a dominant arc).
const GAP_WITHIN_ZONE_DEG = 1.5
// Bigger gap specifically at a boundary between two DIFFERENT zone groups —
// this is what makes the three arcs read as clearly separate sections.
const GAP_BETWEEN_ZONES_DEG = 9

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

// Same tangent-aligned-rect approach as the app's own SegmentedCoherenceRing
// (Skrin 2/3): translate to the tick's own center point on the circle, then
// rotate around THAT point — length runs tangent to the circle, thickness
// runs radially, no extra +/-90 offset needed since polarToCartesian's own
// -90 convention (0deg = top, clockwise) already accounts for it.
function tickRectProps(cx: number, cy: number, r: number, angleDeg: number, length: number, thickness: number) {
  const center = polarToCartesian(cx, cy, r, angleDeg)
  return {
    x: -length / 2,
    y: -thickness / 2,
    width: length,
    height: thickness,
    rx: Math.min(length, thickness) * 0.35,
    transform: `translate(${center.x} ${center.y}) rotate(${angleDeg})`,
  }
}

export function SegmentedRing({ zones, children }: { zones: Zone[]; children?: React.ReactNode }) {
  const size = 320
  const c = size / 2
  const radius = 138
  const tickThickness = 18 // radial

  // Gap BEFORE each tick: bigger if this tick starts a new zone group than
  // the one before it (wrapping around from the last tick back to the
  // first), otherwise the small within-zone gap. Tick angular width is then
  // whatever's left after all 36 gaps are subtracted from the full circle —
  // so the ring always closes exactly at 360°, however many of the three
  // zone groups are actually present right now (a single fully-dominant
  // zone has zero boundaries; three present zones have three).
  const gapBefore = zones.map((zone, i) => {
    const prevZone = zones[(i - 1 + zones.length) % zones.length]
    return zone !== prevZone ? GAP_BETWEEN_ZONES_DEG : GAP_WITHIN_ZONE_DEG
  })
  const totalGapDeg = gapBefore.reduce((sum, g) => sum + g, 0)
  const tickWidthDeg = (360 - totalGapDeg) / zones.length

  let edge = 0 // 0deg = top; dominance has no meaningful "start time" so an arbitrary fixed start point is fine
  const ticks = zones.map((zone, i) => {
    edge += gapBefore[i]
    const midAngle = edge + tickWidthDeg / 2
    const tickLength = radius * ((tickWidthDeg * Math.PI) / 180) // arc length in px
    edge += tickWidthDeg
    return { zone, midAngle, tickLength }
  })

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {ticks.map((t, i) => (
          <rect
            key={i}
            {...tickRectProps(c, c, radius, t.midAngle, t.tickLength, tickThickness)}
            fill={ZONE_FILL[t.zone]}
            style={{ transition: 'fill 600ms ease-out' }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
