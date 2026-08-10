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
