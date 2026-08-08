import { SessionIcon, ReviewIcon, JournalIcon, GuidesIcon, NafasCloudIcon } from '@/components/nav/icons'
import { cn } from '@/lib/utils'

export type Tab = 'session' | 'review' | 'journal' | 'guides' | 'nafascloud'

interface BottomNavProps {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: Array<{ id: Tab; label: string; Icon: typeof SessionIcon }> = [
  { id: 'session', label: 'Sesi', Icon: SessionIcon },
  { id: 'review', label: 'Semakan', Icon: ReviewIcon },
  { id: 'journal', label: 'Jurnal', Icon: JournalIcon },
  { id: 'guides', label: 'Panduan', Icon: GuidesIcon },
  { id: 'nafascloud', label: 'NafasCloud', Icon: NafasCloudIcon },
]

// The one deliberately dark surface in Bernafas' otherwise light pastel app
// — a dark tab bar reads as a stable, always-on-top anchor over any of the
// four session pages (including the full-bleed Skrin 2 scene), the same
// role a dark nav plays in HeartMath/Inner Balance-style wellness apps.
// Fixed + safe-bottom aware; --nav-height (index.css) is the single source
// every screen's own bottom padding reads to clear it.
export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around"
      style={{
        height: 'calc(var(--nav-height) + var(--safe-bottom))',
        paddingBottom: 'var(--safe-bottom)',
        background: 'var(--color-nav-bg)',
        backdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = id === active
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={isActive ? 'page' : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-1"
            style={{ color: isActive ? 'var(--color-nav-active)' : 'var(--color-nav-inactive)' }}
          >
            <Icon active={isActive} />
            <span className={cn('text-[10px] font-medium tracking-tight', isActive && 'font-semibold')}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
