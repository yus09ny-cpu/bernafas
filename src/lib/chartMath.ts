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
