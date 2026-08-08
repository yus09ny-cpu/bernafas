import type { ReactNode } from 'react'
import { getCoherenceZone, ZONE_COLOR } from '@/lib/coherenceZones'
import type { HistoryPoint } from '@/lib/sessionStats'

interface SegmentedCoherenceRingProps {
  history: HistoryPoint[]
  elapsedSec: number
  size?: number
  children?: ReactNode // center content (PulseDot on Skrin 1, FlowerBloom on Skrin 3)
}

// A HeartMath-style dial: divided into discrete tick segments that light up
// clockwise as the session progresses, each keeping the coherence-zone color
// it had *when it was reached* — so the ring doubles as a compact history
// timeline, not just a spinner. Full lap = a nominal 3-minute session (the
// "Tenang dalam 3 minit" pitch in the README) — sessions that run longer
// simply stay fully lit rather than lapping a second time.
const NUM_SEGMENTS = 40
const TARGET_SESSION_SEC = 180
const SEGMENT_DURATION = TARGET_SESSION_SEC / NUM_SEGMENTS
const GAP_DEGREES = 2.4
const TRACK_COLOR = '#d7e3e1'

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

// Each segment is its own small straight rectangle ("tick"), not a slice of
// one continuous curved stroke — a prior version drew all 40 segments as
// arcs sharing the ring's curvature, so same-colored neighbors visually
// fused into one smooth band instead of reading as distinct boxes. A flat
// rect has hard corners, so adjacent segments stay visually separate
// (the GAP_DEGREES gap between them) regardless of color.
//
// length runs tangent to the circle (the segment's "along the ring" size),
// thickness runs radially (the ring's "band width"), centered on the
// segment's midpoint angle. Rotating by that same angle aligns the rect's
// local +x axis (its length) with the circle's tangent direction there —
// works out exactly with no extra +/-90° offset because polarToCartesian's
// own -90° convention (0° = top) already accounts for it.
function tickRectProps(cx: number, cy: number, r: number, angleDeg: number, length: number, thickness: number) {
  const center = polarToCartesian(cx, cy, r, angleDeg)
  return {
    x: -length / 2,
    y: -thickness / 2,
    width: length,
    height: thickness,
    rx: thickness * 0.35,
    transform: `translate(${center.x} ${center.y}) rotate(${angleDeg})`,
  }
}

// The color a segment "locked in" — the most recent history sample at or
// before this segment's time window, so an already-passed segment never
// changes color again once later, lower/higher coherence arrives.
function colorForSegment(history: HistoryPoint[], windowEndSec: number): string | null {
  let color: string | null = null
  for (const point of history) {
    if (point.t > windowEndSec) break
    color = ZONE_COLOR[getCoherenceZone(point.coherence)]
  }
  return color
}

export default function SegmentedCoherenceRing({ history, elapsedSec, size = 260, children }: SegmentedCoherenceRingProps) {
  const r = size * 0.46
  const tickThickness = size * 0.045
  const center = size / 2
  const segmentSpan = 360 / NUM_SEGMENTS - GAP_DEGREES
  const tickLength = r * ((segmentSpan * Math.PI) / 180) // arc-length equivalent, so tick size matches the ring's old footprint

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        {Array.from({ length: NUM_SEGMENTS }, (_, i) => {
          const segStart = i * (360 / NUM_SEGMENTS)
          const midAngle = segStart + segmentSpan / 2
          const windowEndSec = (i + 1) * SEGMENT_DURATION
          const isReached = elapsedSec >= i * SEGMENT_DURATION
          const zoneColor = isReached ? colorForSegment(history, windowEndSec) : null
          return (
            <rect
              key={i}
              {...tickRectProps(center, center, r, midAngle, tickLength, tickThickness)}
              fill={zoneColor ?? TRACK_COLOR}
              style={{ transition: 'fill 500ms ease-out' }}
            />
          )
        })}
      </svg>
      <div className="relative flex items-center justify-center">{children}</div>
    </div>
  )
}
