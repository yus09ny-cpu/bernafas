// Shared SVG-polyline math for the Skrin 4 charts (HrvLineChart,
// CoherenceBandChart, RmssdTrendChart) — same "plain SVG polyline, no
// charting library" approach as the original TrendSparkline, generalized so
// the three charts don't each re-derive the same x/y scaling.

export interface ChartPoint {
  t: number
  value: number
}

export interface LineGeometry {
  path: string
  last: { x: number; y: number; value: number } | null
}

interface BuildLineOptions {
  width: number
  height: number
  padX: number
  padY: number
  minValue: number
  maxValue: number
}

export function buildLinePath(points: ChartPoint[], opts: BuildLineOptions): LineGeometry {
  if (points.length === 0) return { path: '', last: null }
  const { width, height, padX, padY, minValue, maxValue } = opts
  const maxT = Math.max(1, points[points.length - 1].t)
  const range = Math.max(1e-6, maxValue - minValue)

  const x = (t: number) => padX + (t / maxT) * (width - padX * 2)
  const y = (v: number) => height - padY - ((v - minValue) / range) * (height - padY * 2)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const lastPoint = points[points.length - 1]
  return { path, last: { x: x(lastPoint.t), y: y(lastPoint.value), value: lastPoint.value } }
}

// ─── Progress tab additions ────────────────────────────────────────────────
// Same x/y scaling as buildLinePath (`t` here is a session's 0-based index,
// oldest first, not elapsed seconds — Progress's four charts are one bar/
// point per *session*, evenly spaced regardless of the real calendar gap
// between sessions, so a handful of far-apart sessions still lays out
// legibly instead of clustering into an unreadable sliver). Kept as
// separate exports rather than a mode flag on buildLinePath, since a bar
// chart's geometry (discrete rects) is a different shape of output than a
// line's, not a variant of the same one.

export interface AreaGeometry extends LineGeometry {
  areaPath: string
}

// Same line as buildLinePath, plus a closed path back down to the
// baseline and across, for an area fill under it. Used by
// SessionTrendAreaChart (Achievement/Avg Coherence/Avg BPM) — needs at
// least 2 points, same as buildLinePath's own line (a single point can't
// describe a filled region's edge either).
export function buildAreaPath(points: ChartPoint[], opts: BuildLineOptions): AreaGeometry {
  const { path, last } = buildLinePath(points, opts)
  if (points.length === 0 || !last) return { path, last, areaPath: '' }
  const { width, height, padX, padY } = opts
  const maxT = Math.max(1, points[points.length - 1].t)
  const x = (t: number) => padX + (t / maxT) * (width - padX * 2)
  const baselineY = height - padY
  const firstX = x(points[0].t)
  const lastX = x(points[points.length - 1].t)
  const areaPath = `${path} L ${lastX.toFixed(1)} ${baselineY.toFixed(1)} L ${firstX.toFixed(1)} ${baselineY.toFixed(1)} Z`
  return { path, last, areaPath }
}

export interface BarRect {
  x: number
  y: number
  width: number
  height: number
  value: number
}

interface BuildBarOptions extends BuildLineOptions {
  gapRatio?: number // fraction of each bar's slot left as gap — default 0.35
}

// One rect per point, evenly spaced across the width regardless of `t`
// spacing (bar charts are inherently categorical here — see file header).
// Degrades gracefully at low N: with 1-2 points, slot width just grows to
// fill the available space rather than producing a broken/cramped layout.
export function buildBarLayout(points: ChartPoint[], opts: BuildBarOptions): BarRect[] {
  if (points.length === 0) return []
  const { width, height, padX, padY, minValue, maxValue, gapRatio = 0.35 } = opts
  const range = Math.max(1e-6, maxValue - minValue)
  const slot = (width - padX * 2) / points.length
  const barWidth = slot * (1 - gapRatio)
  const baselineY = height - padY
  const yFromValue = (v: number) => height - padY - ((v - minValue) / range) * (height - padY * 2)

  return points.map((p, i) => {
    const xCenter = padX + slot * (i + 0.5)
    const yTop = yFromValue(p.value)
    return { x: xCenter - barWidth / 2, y: yTop, width: barWidth, height: Math.max(0, baselineY - yTop), value: p.value }
  })
}
