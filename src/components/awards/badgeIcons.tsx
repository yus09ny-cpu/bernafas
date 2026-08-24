// Anugerah's own badge iconography — same hand-drawn family as
// screens/review/icons.tsx (24x24 viewBox, 1.75 stroke, round caps/joins),
// built from the app's existing "simple geometric primitives" convention
// (circles, lines, arcs — no illustrative multi-bezier art anywhere else
// in this codebase) rather than any icon-library glyph. Two original
// patterns, both centered on a small geometric heart (two circles + a
// quadratic-curve taper to a point, not a copied heart-icon path):
// - Ketekunan (practice count) → a sunburst: 10 rays radiating out from
//   the heart, echoing a "sun" the way PracticeBadgeIcon's old tick-ring
//   did, now with the heart as the sun's center instead of a plain circle.
// - Sehari Pelbagai Kali / Aliran Koheren → the same heart nested inside
//   concentric rounded rings, ripples radiating outward — 2 rings for the
//   same-day category, 3 for the streak category, sharing one internal
//   component (HeartRipplesIcon) since both read as "coherence around a
//   heart", only the color (per-tier, see lib/awards.ts) and ring count
//   differ. `color` is the only prop that varies per tier — shape stays
//   constant within a category so the grid reads as "same badge, different
//   level", not unrelated icons.

const STROKE_WIDTH = 1.75

interface BadgeIconProps {
  color: string
  size?: number
}

// Shared heart — two lobe circles + a quadratic taper down to a rounded
// point, small enough (max reach ~3.6 from center) to nest inside
// HeartRipplesIcon's innermost ring, or scale up on its own for
// PracticeBadgeIcon's sunburst.
function Heart({ color, scale = 1 }: { color: string; scale?: number }) {
  const lobeR = 1.5 * scale
  const lobeCx = 1.4 * scale
  const lobeCy = 1.2 * scale
  const tipY = 3.6 * scale
  return (
    <>
      <circle cx={12 - lobeCx} cy={12 - lobeCy} r={lobeR} stroke={color} strokeWidth={STROKE_WIDTH} />
      <circle cx={12 + lobeCx} cy={12 - lobeCy} r={lobeR} stroke={color} strokeWidth={STROKE_WIDTH} />
      <path
        d={`M${12 - lobeCx - lobeR} ${12 - lobeCy + 0.5 * scale}Q${12 - lobeCx - lobeR} ${12 + tipY - 2.3 * scale} 12 ${12 + tipY}Q${12 + lobeCx + lobeR} ${12 + tipY - 2.3 * scale} ${12 + lobeCx + lobeR} ${12 - lobeCy + 0.5 * scale}`}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  )
}

// Ketekunan — heart at the center of a 10-ray sunburst.
export function PracticeBadgeIcon({ color, size = 26 }: BadgeIconProps) {
  const rays = Array.from({ length: 10 })
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {rays.map((_, i) => {
        const angle = (i / rays.length) * 2 * Math.PI - Math.PI / 2
        const x1 = 12 + Math.cos(angle) * 7.6
        const y1 = 12 + Math.sin(angle) * 7.6
        const x2 = 12 + Math.cos(angle) * 10.3
        const y2 = 12 + Math.sin(angle) * 10.3
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
      })}
      <Heart color={color} scale={1.15} />
    </svg>
  )
}

// Sehari Pelbagai Kali / Aliran Koheren — heart nested inside `rings`
// concentric circles, evenly spaced between the heart's edge and a tighter
// outer radius than the first pass (closer rings read more like ripples
// clustered around the heart, less like a spread-out target/bullseye).
function HeartRipplesIcon({ color, size = 26, rings }: BadgeIconProps & { rings: number }) {
  const minR = 5.4
  const maxR = 8.0
  const radii = Array.from({ length: rings }, (_, i) => minR + ((maxR - minR) * i) / Math.max(rings - 1, 1))
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {radii.map(r => (
        <circle key={r} cx="12" cy="12" r={r} stroke={color} strokeWidth={STROKE_WIDTH} />
      ))}
      <Heart color={color} />
    </svg>
  )
}

export function SameDayBadgeIcon({ color, size = 26 }: BadgeIconProps) {
  return <HeartRipplesIcon color={color} size={size} rings={2} />
}

export function StreakBadgeIcon({ color, size = 26 }: BadgeIconProps) {
  return <HeartRipplesIcon color={color} size={size} rings={3} />
}
