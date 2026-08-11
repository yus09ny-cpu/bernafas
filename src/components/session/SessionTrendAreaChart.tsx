import { buildAreaPath } from '@/lib/chartMath'
import type { SessionTrendPoint } from '@/lib/sessionsHistory'
import { formatSessionDate } from '@/lib/utils'
import { ChartCard, ChartEmptyState } from '@/components/session/ChartCard'

interface SessionTrendAreaChartProps {
  title: string
  data: SessionTrendPoint[]
  value: (point: SessionTrendPoint) => number | null
  color: string
  format: (v: number) => string
}

const WIDTH = 320
const HEIGHT = 110
const PAD_X = 8
const PAD_Y = 14

// Generic single-series area chart shared by all three Progress trend
// cards (Achievement/Avg Coherence/Avg BPM) below — one component so the
// three don't drift into three near-identical implementations. `value`
// picks the field, `color`/`format` are per-metric, everything else
// (layout, empty state, date labels) is shared.
//
// x is each session's 0-based index (oldest first), NOT real elapsed
// time — see chartMath.ts's file header: sessions aren't evenly spaced in
// real time, so an index-based x-axis stays legible (bars/points evenly
// spread across the width) regardless of gaps between sessions, which
// matters most exactly when there are few of them.
export default function SessionTrendAreaChart({ title, data, value, color, format }: SessionTrendAreaChartProps) {
  const points = data
    .map((p, i) => ({ t: i, value: value(p), startedAt: p.startedAt }))
    .filter((p): p is { t: number; value: number; startedAt: string } => p.value !== null)

  if (points.length < 2) {
    return (
      <ChartCard title={title}>
        <ChartEmptyState message="Perlu sekurang-kurangnya 2 sesi untuk papar trend" />
      </ChartCard>
    )
  }

  const values = points.map(p => p.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  // Headroom so a flat/near-flat series doesn't hug the chart's top/bottom
  // edge — a % of the series' own range rather than a fixed +/-N like
  // HrvLineChart/RmssdTrendChart use, since Achievement/Coherence/BPM each
  // have very different units and scales.
  const pad = Math.max((hi - lo) * 0.15, 1)
  const { areaPath, path, last } = buildAreaPath(points, {
    width: WIDTH,
    height: HEIGHT,
    padX: PAD_X,
    padY: PAD_Y,
    minValue: lo - pad,
    maxValue: hi + pad,
  })

  return (
    <ChartCard title={title}>
      <div className="relative">
        <svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
          <line x1={PAD_X} y1={HEIGHT / 2} x2={WIDTH - PAD_X} y2={HEIGHT / 2} stroke="#e1e0d9" strokeWidth={1} />
          <path d={areaPath} fill={color} fillOpacity={0.15} stroke="none" />
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {last && <circle cx={last.x} cy={last.y} r={3.5} fill={color} />}
        </svg>
        {/* See HrvLineChart for why this label is plain HTML, not SVG <text>. */}
        {last && (
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-[11px] font-bold"
            style={{ left: `${(last.x / WIDTH) * 100}%`, top: `${(last.y / HEIGHT) * 100}%`, color }}
          >
            {format(last.value)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
        <span>{formatSessionDate(points[0].startedAt)}</span>
        <span>{formatSessionDate(points[points.length - 1].startedAt)}</span>
      </div>
    </ChartCard>
  )
}
