import type { AwardStatus } from '@/lib/awards'
import { PracticeBadgeIcon, SameDayBadgeIcon, StreakBadgeIcon } from './badgeIcons'

const ICONS = {
  practice: PracticeBadgeIcon,
  sameDay: SameDayBadgeIcon,
  streak: StreakBadgeIcon,
}

// Earned-badge detail — same full-screen dimmed-backdrop pattern as
// ConfirmDialog.tsx (backdrop click closes, card stops propagation) but
// info-only: no confirm/cancel pair, just an icon + one BM sentence + a
// single close button. `badge` is only ever an earned one here — BadgeTile
// never lets a locked tile call onSelect, so there's no "locked" branch to
// design for.
export default function BadgeDetail({ badge, onClose }: { badge: AwardStatus | null; onClose: () => void }) {
  if (!badge) return null
  const Icon = ICONS[badge.category]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-[var(--shadow-soft)]"
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: `${badge.color}1f` }}
        >
          <Icon color={badge.color} size={34} />
        </div>
        <p className="text-sm font-semibold text-[var(--color-text)]">{badge.label}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{badge.description}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)]"
        >
          Tutup
        </button>
      </div>
    </div>
  )
}
