import { Hand, RotateCcw, X } from 'lucide-react'
import { DeviceConnect } from '@/components/session/DeviceConnect'
import { SmoothnessSetting } from '@/components/session/SmoothnessSetting'
import type { HeartRateDevice } from '@/hooks/useHeartRateDevice'

// Skrin-1-only extras — device-connect pill + smoothness setting, folded
// into this shared floating header instead of Page1Ring rendering a second
// row of its own for them. Omitted on Skrin 2-4 (undefined `page1` prop),
// which keep the header's original two-end layout untouched below.
interface Page1HeaderExtras {
  device: HeartRateDevice
  simulated: boolean
  smoothness: number
  onSmoothnessChange: (value: number) => void
}

interface SessionHeaderProps {
  bpm: number | null
  isDeviceConnected: boolean
  contactLost: boolean
  sessionActive: boolean
  onEnd: () => void
  page1?: Page1HeaderExtras
}

// Floating header shared by all four carousel pages — dark translucent pills
// so the bpm badge and end button stay legible whether the page underneath
// is the light pastel surface (Skrin 1/3/4) or the full-bleed scene photo
// (Skrin 2), without each page having to pick its own contrast-safe colors.
//
// Left padding clears App.tsx's fixed AccountMenu button, which anchors to
// the same top-left corner (same top offset) across every screen — without
// it, the bpm badge rendered underneath and got visually clipped by the
// account button sitting on top of it. --account-menu-clear (index.css) is
// the single source for that clearance so the two can't drift back out of
// sync if AccountMenu's own size/position ever changes.
//
// The right-hand button does double duty and swaps its icon to say so: X
// ends the running session (freezes Skrin 4 into a summary, doesn't
// navigate away — the user may still swipe/tap back through 1-3); once
// ended, the same button becomes a refresh icon that starts a new session.
// Same callback either way — SessionScreen decides which action it is.
export default function SessionHeader({ bpm, isDeviceConnected, contactLost, sessionActive, onEnd, page1 }: SessionHeaderProps) {
  const EndIcon = sessionActive ? X : RotateCcw
  const endLabel = sessionActive ? 'Tamatkan sesi' : 'Sesi baharu'

  const bpmBadge = isDeviceConnected ? (
    contactLost ? (
      <span className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
        <Hand size={12} /> letak jari semula
      </span>
    ) : (
      <span className="pointer-events-auto rounded-full bg-black/30 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
        {bpm !== null ? `${bpm} bpm` : 'menunggu bacaan...'}
      </span>
    )
  ) : (
    <span />
  )

  if (page1) {
    // Consolidated single row: [end icon + bpm] grouped on the left,
    // [device-connect pill + smoothness icon] grouped on the right —
    // replaces what used to be this floating row PLUS a second, separate
    // row Page1Ring rendered below it. "Tamat Sesi"'s text label is dropped
    // (icon-only, aria-label carries it) to make room for the end icon to
    // sit compactly next to bpm rather than pinned to the far edge; "Data
    // langsung" is dropped entirely when a device IS actually connected
    // (redundant with the bpm badge already proving live data) and kept
    // only for "Tanpa peranti" (no device), where it's the one state that's
    // actually informative. Reclaimed height verified via the same
    // Playwright sweep as the graph/ring gap fix — see Page1Ring.tsx's
    // paddingTop comment.
    return (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 pr-5"
        style={{ paddingTop: 'calc(1rem + var(--safe-top))', paddingLeft: 'var(--account-menu-clear)' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEnd}
            aria-label={endLabel}
            className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-transform active:scale-90"
          >
            <EndIcon size={16} />
          </button>
          {bpmBadge}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {page1.simulated && (
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">Tanpa peranti</span>
          )}
          <DeviceConnect device={page1.device} />
          <SmoothnessSetting value={page1.smoothness} onChange={page1.onSmoothnessChange} />
        </div>
      </div>
    )
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between pr-5"
      style={{ paddingTop: 'calc(1rem + var(--safe-top))', paddingLeft: 'var(--account-menu-clear)' }}
    >
      {bpmBadge}
      <button
        type="button"
        onClick={onEnd}
        aria-label={endLabel}
        className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-transform active:scale-90"
      >
        <EndIcon size={16} />
        {sessionActive ? 'Tamat Sesi' : 'Sesi Baharu'}
      </button>
    </div>
  )
}
