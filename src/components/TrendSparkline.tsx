import type { CoherencePoint } from '@/hooks/useHrvSession'

interface TrendSparklineProps {
  points: CoherencePoint[]
}

// Simple "trend mudah" line for the post-session summary — no charting
// library, just an SVG polyline. Not meant to be analytically precise, just
// a glanceable "did it drift up or down" shape.
export default function TrendSparkline({ points }: TrendSparklineProps) {
  if (points.length < 2) return null
  const width = 280
  const height = 72
  const padX = 6
  const padY = 10
  const maxT = Math.max(1, points[points.length - 1].t)
  const x = (t: number) => padX + (t / maxT) * (width - padX * 2)
  const y = (v: number) => height - padY - v * (height - padY * 2)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const first = points[0].value
  const last = points[points.length - 1].value
  const trendUp = last >= first

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xs">
        <path d={path} fill="none" stroke={trendUp ? '#3e9c9c' : '#f4a785'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xs text-[var(--color-text-muted)]">
        Trend {trendUp ? 'menaik' : 'menurun'} sepanjang sesi
      </span>
    </div>
  )
}
