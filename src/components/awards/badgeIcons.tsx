// Anugerah's own badge iconography — same hand-drawn family as
// screens/review/icons.tsx (24x24 viewBox, 1.75 stroke, round caps/joins),
// but each glyph deliberately echoes a visual motif this app already owns
// elsewhere, rather than any medal/trophy/star cliché from another app:
// - Ketekunan (practice count) → a dial of ticks around a circle, the same
//   discrete-tick language SegmentedCoherenceRing.tsx uses for its own
//   session-progress ring.
// - Sehari Pelbagai Kali (same-day) → a calendar day cell with dots,
//   literal "more than one session, one day".
// - Aliran Koheren (streak) → a pulse/HRV waveform inside a circle, same
//   family as PulseWaveform/HrvLineChart's own line language.
// `color` is the only prop that varies per tier (see lib/awards.ts's
// per-tier color maps) — shape stays constant within a category so the
// grid reads as "same badge, different level", not unrelated icons.

const STROKE_WIDTH = 1.75

interface BadgeIconProps {
  color: string
  size?: number
}

export function PracticeBadgeIcon({ color, size = 26 }: BadgeIconProps) {
  const ticks = Array.from({ length: 8 })
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="6.5" stroke={color} strokeWidth={STROKE_WIDTH} />
      {ticks.map((_, i) => {
        const angle = (i / ticks.length) * 2 * Math.PI - Math.PI / 2
        const x1 = 12 + Math.cos(angle) * 8
        const y1 = 12 + Math.sin(angle) * 8
        const x2 = 12 + Math.cos(angle) * 9.8
        const y2 = 12 + Math.sin(angle) * 9.8
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
      })}
    </svg>
  )
}

export function SameDayBadgeIcon({ color, size = 26 }: BadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="5.5" width="16" height="14.5" rx="3" stroke={color} strokeWidth={STROKE_WIDTH} />
      <path d="M4 10h16" stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
      <path d="M8.5 3v3M15.5 3v3" stroke={color} strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
      <circle cx="9" cy="15" r="1.1" fill={color} />
      <circle cx="12" cy="15" r="1.1" fill={color} />
      <circle cx="15" cy="15" r="1.1" fill={color} />
    </svg>
  )
}

export function StreakBadgeIcon({ color, size = 26 }: BadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={STROKE_WIDTH} />
      <path
        d="M6.5 12.5h2l1.5-4 2.5 8 1.5-4h3.5"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
