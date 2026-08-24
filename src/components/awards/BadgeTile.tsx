import { Lock } from 'lucide-react'
import type { AwardStatus } from '@/lib/awards'
import { PracticeBadgeIcon, SameDayBadgeIcon, StreakBadgeIcon } from './badgeIcons'

const ICONS = {
  practice: PracticeBadgeIcon,
  sameDay: SameDayBadgeIcon,
  streak: StreakBadgeIcon,
}

// One tile in BadgeGrid — earned tiles are tappable (opens BadgeDetail),
// locked ones aren't (a real `disabled` button, not just a styled-different
// one, so there's nothing to tap through to on a badge with no
// achievedAt/description to show yet). Locked look is grayscale + reduced
// opacity on the exact same colored icon rather than a separate "locked"
// glyph set — the shape staying recognizable is the point (a preview of
// what's coming), the lock icon in the corner is just the affordance that
// says "not yet".
export default function BadgeTile({ badge, onSelect }: { badge: AwardStatus; onSelect: (badge: AwardStatus) => void }) {
  const Icon = ICONS[badge.category]

  return (
    <button
      type="button"
      onClick={() => onSelect(badge)}
      disabled={!badge.earned}
      className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border py-3 shadow-[var(--shadow-soft)] transition-transform ${
        badge.earned
          ? 'border-[var(--color-card-border)] bg-white/70 active:scale-95'
          : 'border-[var(--color-border)] bg-white/40'
      }`}
    >
      <div className={badge.earned ? '' : 'opacity-35 grayscale'}>
        <Icon color={badge.earned ? badge.color : '#94a3b8'} />
      </div>
      <span className={`text-[11px] font-semibold ${badge.earned ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
        {badge.label}
      </span>
      {!badge.earned && <Lock size={11} className="absolute right-2.5 top-2.5 text-[var(--color-text-muted)]" />}
    </button>
  )
}
