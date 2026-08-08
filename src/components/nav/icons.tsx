// Custom bottom-nav icon set — hand-authored line glyphs instead of reaching
// for lucide's stock icons, so the nav reads as Bernafas' own rather than a
// generic UI kit. Same family throughout: 24x24 viewBox, 1.75 stroke, round
// caps/joins, filled only for the small "active" accent details.

interface NavIconProps {
  active?: boolean
  size?: number
}

const STROKE_WIDTH = 1.75

// Session — a breathing wave, the same "rhythm strip" idea as PulseWaveform.
export function SessionIcon({ active, size = 22 }: NavIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M2 13c1.5 0 1.5-4 3-4s1.5 6 3 6 1.5-9 3-9 1.5 10 3 10 1.5-6 3-6 1.5 3 3 3"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.85}
      />
    </svg>
  )
}

// Review — ascending bars, a glance-back at past sessions.
export function ReviewIcon({ active, size = 22 }: NavIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="13" width="4" height="7.5" rx="1.2" stroke="currentColor" strokeWidth={STROKE_WIDTH} fill={active ? 'currentColor' : 'none'} fillOpacity={0.25} />
      <rect x="10" y="8.5" width="4" height="12" rx="1.2" stroke="currentColor" strokeWidth={STROKE_WIDTH} fill={active ? 'currentColor' : 'none'} fillOpacity={0.25} />
      <rect x="16.5" y="3.5" width="4" height="17" rx="1.2" stroke="currentColor" strokeWidth={STROKE_WIDTH} fill={active ? 'currentColor' : 'none'} fillOpacity={0.25} />
    </svg>
  )
}

// Journal — an open notebook with a single reflection line.
export function JournalIcon({ active, size = 22 }: NavIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5.5c-1.8-1.1-4.3-1.5-7-1.2v13.4c2.7-.3 5.2.1 7 1.2 1.8-1.1 4.3-1.5 7-1.2V4.3c-2.7-.3-5.2.1-7 1.2Z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={0.12}
      />
      <path d="M12 5.5v13.4" stroke="currentColor" strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
    </svg>
  )
}

// Guides — a compass, for guided programs/technique explainers.
export function GuidesIcon({ active, size = 22 }: NavIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={STROKE_WIDTH} />
      <path
        d="M15 9l-2.2 5.2L9.6 16l2.2-5.2L15 9Z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={0.3}
      />
    </svg>
  )
}

// NafasCloud — cloud sync, for the community/leaderboard tab.
export function NafasCloudIcon({ active, size = 22 }: NavIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M7.5 17.5a4 4 0 0 1-.5-7.97 5 5 0 0 1 9.62-1.66A4.5 4.5 0 0 1 16.5 17.5h-9Z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={0.18}
      />
      <circle cx="12" cy="13.2" r="1.1" fill="currentColor" opacity={active ? 1 : 0.7} />
    </svg>
  )
}
