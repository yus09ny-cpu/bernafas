import { buildLinePath } from '@/lib/chartMath'
import type { HistoryPoint } from '@/lib/sessionStats'
import { ChartCard, ChartEmptyState } from '@/components/session/ChartCard'

interface RmssdTrendChartProps {
  history: HistoryPoint[]
}

const WIDTH = 320
const HEIGHT = 96
const PAD_X = 8
const PAD_Y = 14

// "RMSSD trend chart" — replaces HeartMath's frequency-domain Power
// Spectral Density tab with our own time-domain metric (raw RMSSD in ms,
// via hrvCoherence.ts's computeRmssdMs — the same input computeCoherence()
// log-transforms into the 0-1 score shown elsewhere on this page). Kept as
// its own chart/axis rather than overlaid on the coherence chart: ms and a
// 0-1 score are different units, and this skill's one-axis rule treats that
// as two charts, not a dual-axis one.
export default function RmssdTrendChart({ history }: RmssdTrendChartProps) {
  const points = history.filter(p => p.rmssdMs !== null).map(p => ({ t: p.t, value: p.rmssdMs as number }))

  if (points.length < 2) {
    return (
      <ChartCard title="Trend RMSSD (ms)">
        <ChartEmptyState />
      </ChartCard>
    )
  }

  const values = points.map(p => p.value)
  const minValue = Math.max(0, Math.min(...values) - 5)
  const maxValue = Math.max(...values) + 5
  const { path, last } = buildLinePath(points, { width: WIDTH, height: HEIGHT, padX: PAD_X, padY: PAD_Y, minValue, maxValue })

  return (
    <ChartCard title="Trend RMSSD (ms)">
      <div className="relative">
        <svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
          <line x1={PAD_X} y1={HEIGHT / 2} x2={WIDTH - PAD_X} y2={HEIGHT / 2} stroke="#e1e0d9" strokeWidth={1} />
          <path d={path} fill="none" stroke="#6fa8dc" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {last && <circle cx={last.x} cy={last.y} r={3.5} fill="#6fa8dc" />}
        </svg>
        {/* See HrvLineChart for why this label is plain HTML, not SVG <text>. */}
        {last && (
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-[11px] font-bold text-[#3f6fa8]"
            style={{ left: `${(last.x / WIDTH) * 100}%`, top: `${(last.y / HEIGHT) * 100}%` }}
          >
            {Math.round(last.value)}
          </span>
        )}
      </div>
    </ChartCard>
  )
}
