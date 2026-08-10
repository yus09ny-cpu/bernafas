import { ZONE_COLOR, ZONE_LABEL_BM, type CoherenceZone } from '@/lib/coherenceZones'

interface ZoneStatRowProps {
  low: number | null
  medium: number | null
  high: number | null
}

const ZONES: CoherenceZone[] = ['low', 'medium', 'high']

// History detail's zone breakdown — % of session time in each coherence
// zone, read straight from the low_pct/medium_pct/high_pct columns
// saveSession() already computed and wrote at session end (see
// sessionPersistence.ts), not recomputed from `history` here, so this
// always matches what was actually saved. Same red/blue/green ZONE_COLOR
// used by the segmented ring and CoherenceBandChart — color is never the
// only signal (per the dataviz skill), so every swatch is paired with its
// BM label, same as CoherenceBandChart's own legend row.
export default function ZoneStatRow({ low, medium, high }: ZoneStatRowProps) {
  const values: Record<CoherenceZone, number | null> = { low, medium, high }
  return (
    <div className="flex w-full gap-2">
      {ZONES.map(zone => (
        <div
          key={zone}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-[var(--color-card-border)] bg-white/70 py-4 shadow-[var(--shadow-soft)]"
        >
          <span className="text-2xl font-extrabold tabular-nums" style={{ color: ZONE_COLOR[zone] }}>
            {values[zone] !== null ? `${values[zone]}%` : '—'}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            <span className="h-2 w-2 rounded-full" style={{ background: ZONE_COLOR[zone] }} />
            {ZONE_LABEL_BM[zone]}
          </span>
        </div>
      ))}
    </div>
  )
}
