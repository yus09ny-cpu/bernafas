// Shared "real-time scrolling line" geometry, extracted from HrvGraph.tsx
// (Skrin 1-3's live tachogram) so Skrin 4's new live coherence graph can
// reuse the exact same dropout-gap-breaking + smoothing logic instead of a
// second, hand-copied version that could quietly drift from it. HrvGraph.tsx
// itself was refactored to call this too — its own rendered output is
// unchanged (same numbers in, same path out), just no longer duplicated.
export interface ScrollPoint {
  t: number // ms epoch
  v: number // already-mapped plot value (bpm, coherence 0-1, whatever)
}

export interface ScrollingSegmentsOptions {
  from: number // window start, ms epoch
  windowMs: number
  width: number
  height: number
  minValue: number
  maxValue: number
  // Real beats/samples can be sparse enough that consecutive accepted
  // points are several real seconds apart. Smoothly interpolating across a
  // gap like that draws a fake spike between two points that were never
  // actually adjacent — break into a new subpath instead whenever the real
  // gap exceeds this, so a dropout reads as a break in the line, not a
  // jagged curve.
  maxGapMs: number
}

export function buildScrollingSegments(points: ScrollPoint[], opts: ScrollingSegmentsOptions): { path: string; area: string } {
  const { from, windowMs, width, height, minValue, maxValue, maxGapMs } = opts
  const x = (t: number) => ((t - from) / windowMs) * width
  const y = (v: number) => height - ((v - minValue) / (maxValue - minValue || 1)) * height

  const coordSegments: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  for (let i = 0; i < points.length; i++) {
    if (i > 0 && points[i]!.t - points[i - 1]!.t > maxGapMs) {
      if (current.length > 1) coordSegments.push(current)
      current = []
    }
    current.push({ x: x(points[i]!.t), y: y(points[i]!.v) })
  }
  if (current.length > 1) coordSegments.push(current)

  // Catmull-Rom-ish smoothing keeps point-to-point detail without jagged corners.
  const buildPath = (coords: { x: number; y: number }[]) => {
    let d = `M ${coords[0]!.x.toFixed(1)} ${coords[0]!.y.toFixed(1)}`
    for (let i = 1; i < coords.length; i++) {
      const p = coords[i - 1]!
      const c = coords[i]!
      const mx = (p.x + c.x) / 2
      d += ` C ${mx.toFixed(1)} ${p.y.toFixed(1)}, ${mx.toFixed(1)} ${c.y.toFixed(1)}, ${c.x.toFixed(1)} ${c.y.toFixed(1)}`
    }
    return d
  }

  const path = coordSegments.map(buildPath).join(' ')
  const area = coordSegments
    .map(coords => {
      const d = buildPath(coords)
      const last = coords[coords.length - 1]!
      return `${d} L ${last.x.toFixed(1)} ${height} L ${coords[0]!.x.toFixed(1)} ${height} Z`
    })
    .join(' ')

  return { path, area }
}
