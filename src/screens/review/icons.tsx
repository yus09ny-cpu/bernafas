// Icon set for Semakan (Review)'s own sub-tab strip — a different
// navigation level from nav/icons.tsx's five BottomNav icons, but the same
// hand-drawn family/spec (24x24 viewBox, 1.75 stroke, round caps/joins),
// kept in a separate file since it's scoped to sub-tabs *within* one main
// tab rather than the app shell.

const STROKE_WIDTH = 1.75

interface SubTabIconProps {
  active?: boolean
  size?: number
}

// History — a clock face, reads clearly as "past sessions over time".
export function HistoryTabIcon({ active, size = 18 }: SubTabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={0.12}
      />
      <path d="M12 7.5v5l3.5 2" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Progress — an ascending trend line, distinct from both HistoryTabIcon's
// clock and the main-nav ReviewIcon's static bars.
export function ProgressTabIcon({ active, size = 18 }: SubTabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 16l5-5.5 4 3.5 7-8.5"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.85}
      />
      <path d="M15 5.5h5v5" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Awards — a rosette (circle + ribbon tails), distinct from HistoryTabIcon's
// plain clock circle and ProgressTabIcon's line. Same circle+path pattern
// as HistoryTabIcon so the three sub-tab icons read as one family.
export function AwardsTabIcon({ active, size = 18 }: SubTabIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="9.5"
        r="5.5"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={0.12}
      />
      <path d="M9 14.3l-2 6 5-2.5 5 2.5-2-6" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
