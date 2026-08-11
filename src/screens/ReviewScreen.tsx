import { useState } from 'react'
import { HistoryTabIcon, ProgressTabIcon } from '@/screens/review/icons'
import HistoryTab from '@/screens/review/HistoryTab'
import ProgressTab from '@/screens/review/ProgressTab'

type ReviewSubTab = 'history' | 'progress'

const SUB_TABS: Array<{ id: ReviewSubTab; label: string; Icon: typeof HistoryTabIcon }> = [
  { id: 'history', label: 'Sejarah', Icon: HistoryTabIcon },
  { id: 'progress', label: 'Progres', Icon: ProgressTabIcon },
]

// Semakan (Review) — icon-based sub-tab strip at the top, its own
// navigation level below BottomNav's five main tabs. paddingTop reuses the
// same calc(4.5rem + safe-top) convention Skrin 1/4 already use for their
// own floating top overlays — this screen sits directly under App.tsx's
// fixed top-left AccountMenu button, and that offset is what clears it
// (same collision SessionHeader.tsx hit and fixed with
// --account-menu-clear; this screen's content starts low enough that the
// simpler "just pad everything down" fix is enough here).
export default function ReviewScreen() {
  const [subTab, setSubTab] = useState<ReviewSubTab>('history')

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto px-5"
      style={{
        paddingTop: 'calc(4.5rem + var(--safe-top))',
        paddingBottom: 'calc(var(--nav-height) + 2rem + var(--safe-bottom))',
      }}
    >
      <div className="mb-4 flex gap-2">
        {SUB_TABS.map(({ id, label, Icon }) => {
          const isActive = id === subTab
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-[var(--color-primary)] text-white' : 'bg-white/70 text-[var(--color-text-muted)]'
              }`}
            >
              <Icon active={isActive} />
              {label}
            </button>
          )
        })}
      </div>

      {subTab === 'history' && <HistoryTab />}
      {subTab === 'progress' && <ProgressTab />}
    </div>
  )
}
