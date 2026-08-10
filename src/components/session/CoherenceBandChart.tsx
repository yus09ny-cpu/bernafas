import { buildLinePath } from '@/lib/chartMath'
import type { SessionHistoryPoint } from '@/lib/sessionStats'
import { ZONE_BOUNDARY, ZONE_COLOR, ZONE_LABEL_BM, type CoherenceZone } from '@/lib/coherenceZones'
import { ChartCard, ChartEmptyState } from '@/components/session/ChartCard'

interface CoherenceBandChartProps {
  history: SessionHistoryPoint[]
}

const WIDTH = 320
const HEIGHT = 110
const PAD_X = 8
const PAD_Y = 6

// "Coherence-over-time band chart" — the three fixed red/blue/green zones
// as background bands (same boundaries as getCoherenceZone(), see
// ZONE_BOUNDARY) with the session's live coherence score woven through them
// as a line, mirroring HeartMath Inner Balance's Coherence tab. The bands
// are a *status* encoding (never color alone, per the dataviz skill) — the
// legend row below always pairs each color with its BM label.
//
// Plots coherenceAlt ("Sumber"), not the original coherence field — matches
// the formula standardization on Skrin 1-3's ring/flower. coherenceAlt can
// be null on a rare early sample; filtered out (like HrvLineChart/
// RmssdTrendChart already do for their own nullable fields) rather than
// defaulted to 0, so a missing reading doesn't draw a fake dip.
export default function CoherenceBandChart({ history }: CoherenceBandChartProps) {
  const points = history.filter(p => p.coherenceAlt !== null).map(p => ({ t: p.t, value: p.coherenceAlt as number }))
  const innerHeight = HEIGHT - PAD_Y * 2
  const yFromValue = (v: number) => HEIGHT - PAD_Y - v * innerHeight

  const bandStops: Array<{ zone: CoherenceZone; from: number; to: number }> = [
    { zone: 'low', from: 0, to: ZONE_BOUNDARY.lowMax },
    { zone: 'medium', from: ZONE_BOUNDARY.lowMax, to: ZONE_BOUNDARY.mediumMax },
    { zone: 'high', from: ZONE_BOUNDARY.mediumMax, to: 1 },
  ]

  const { path } =
    points.length >= 2
      ? buildLinePath(points, { width: WIDTH, height: HEIGHT, padX: PAD_X, padY: PAD_Y, minValue: 0, maxValue: 1 })
      : { path: '' }

  return (
    <ChartCard title="Koheren mengikut masa">
      {points.length >= 2 ? (
        <svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
          {bandStops.map(band => (
            <rect
              key={band.zone}
              x={0}
              y={yFromValue(band.to)}
              width={WIDTH}
              height={yFromValue(band.from) - yFromValue(band.to)}
              fill={ZONE_COLOR[band.zone]}
              opacity={0.14}
            />
          ))}
          <path d={path} fill="none" stroke="#1e293b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <ChartEmptyState />
      )}
      <div className="flex items-center justify-center gap-4">
        {(['low', 'medium', 'high'] as const).map(zone => (
          <span key={zone} className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ background: ZONE_COLOR[zone] }} />
            {ZONE_LABEL_BM[zone]}
          </span>
        ))}
      </div>
    </ChartCard>
  )
}
