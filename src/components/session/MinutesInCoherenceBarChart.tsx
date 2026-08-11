import { buildBarLayout } from '@/lib/chartMath'
import { minutesInCoherence, type SessionTrendPoint } from '@/lib/sessionsHistory'
import { formatSessionDate } from '@/lib/utils'
import { ChartCard, ChartEmptyState } from '@/components/session/ChartCard'

interface MinutesInCoherenceBarChartProps {
  data: SessionTrendPoint[]
}

const WIDTH = 320
const HEIGHT = 110
const PAD_X = 8
const PAD_Y = 14
const COLOR = '#2c7a7a' // --color-primary-dark — literal hex, matching the sibling charts (HrvLineChart etc.), which set SVG fill/stroke as plain hex rather than CSS var() strings

// "Minutes in Coherence" — one bar per session, time spent in medium+high
// coherence zones (minutesInCoherence(), sessionsHistory.ts — duration_sec
// × (medium_pct + high_pct), both already-stored columns, nothing new
// derived from raw history). Unlike the three area charts, a single
// session already renders fine here (one wide bar), so the low-data floor
// is 1 point, not 2 — a bar doesn't need a second point to have a shape
// the way a line/area does.
export default function MinutesInCoherenceBarChart({ data }: MinutesInCoherenceBarChartProps) {
  const points = data
    .map((p, i) => ({ t: i, value: minutesInCoherence(p), startedAt: p.startedAt }))
    .filter((p): p is { t: number; value: number; startedAt: string } => p.value !== null)

  if (points.length === 0) {
    return (
      <ChartCard title="Minit dalam Koheren">
        <ChartEmptyState message="Belum ada data zon koheren untuk dipaparkan" />
      </ChartCard>
    )
  }

  const maxValue = Math.max(...points.map(p => p.value), 1)
  const bars = buildBarLayout(points, { width: WIDTH, height: HEIGHT, padX: PAD_X, padY: PAD_Y, minValue: 0, maxValue })
  const last = points[points.length - 1]

  return (
    <ChartCard title="Minit dalam Koheren">
      <div className="relative">
        <svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
          <line x1={PAD_X} y1={HEIGHT - PAD_Y} x2={WIDTH - PAD_X} y2={HEIGHT - PAD_Y} stroke="#e1e0d9" strokeWidth={1} />
          {bars.map((bar, i) => (
            <rect key={i} x={bar.x} y={bar.y} width={Math.max(bar.width, 1)} height={bar.height} rx={2} fill={COLOR} />
          ))}
        </svg>
        {/* Last bar's value, same plain-HTML-label pattern as the line/area
            charts (HrvLineChart etc.) — an SVG <text> would distort under
            this viewBox's non-uniform preserveAspectRatio="none" scaling. */}
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-[11px] font-bold"
          style={{
            left: `${((bars[bars.length - 1].x + bars[bars.length - 1].width / 2) / WIDTH) * 100}%`,
            top: `${(bars[bars.length - 1].y / HEIGHT) * 100}%`,
            color: COLOR,
          }}
        >
          {Math.round(last.value)} min
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
        <span>{formatSessionDate(points[0].startedAt)}</span>
        <span>{formatSessionDate(points[points.length - 1].startedAt)}</span>
      </div>
    </ChartCard>
  )
}
