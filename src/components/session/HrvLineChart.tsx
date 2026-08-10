import { buildLinePath } from '@/lib/chartMath'
import type { SessionHistoryPoint } from '@/lib/sessionStats'
import { ChartCard, ChartEmptyState } from '@/components/session/ChartCard'

interface HrvLineChartProps {
  history: SessionHistoryPoint[]
}

const WIDTH = 320
const HEIGHT = 96
const PAD_X = 8
const PAD_Y = 14

// "HRV line graph (session timeline)" — the beat-to-beat pulse rate across
// the whole session (bpm per sample), distinct from the top waveform strip
// (which only ever shows the last few seconds). One axis (bpm vs time), a
// thin recessive-gridline card matching the dataviz skill's line-chart spec.
export default function HrvLineChart({ history }: HrvLineChartProps) {
  const points = history.filter(p => p.bpm !== null).map(p => ({ t: p.t, value: p.bpm as number }))

  if (points.length < 2) {
    return (
      <ChartCard title="Nadi sepanjang sesi">
        <ChartEmptyState />
      </ChartCard>
    )
  }

  const values = points.map(p => p.value)
  const minValue = Math.min(...values) - 3
  const maxValue = Math.max(...values) + 3
  const { path, last } = buildLinePath(points, { width: WIDTH, height: HEIGHT, padX: PAD_X, padY: PAD_Y, minValue, maxValue })

  return (
    <ChartCard title="Nadi sepanjang sesi">
      <div className="relative">
        <svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
          <line x1={PAD_X} y1={HEIGHT / 2} x2={WIDTH - PAD_X} y2={HEIGHT / 2} stroke="#e1e0d9" strokeWidth={1} />
          <path d={path} fill="none" stroke="#3e9c9c" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {last && <circle cx={last.x} cy={last.y} r={3.5} fill="#3e9c9c" />}
        </svg>
        {/* Plain HTML label, positioned by percentage — an SVG <text> under this
            chart's non-uniform viewBox scaling (width stretched far more than
            height via preserveAspectRatio="none") renders visibly distorted,
            so the one direct label this chart shows lives outside the SVG. */}
        {last && (
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-[11px] font-bold text-[#2c7a7a]"
            style={{ left: `${(last.x / WIDTH) * 100}%`, top: `${(last.y / HEIGHT) * 100}%` }}
          >
            {Math.round(last.value)}
          </span>
        )}
      </div>
    </ChartCard>
  )
}
