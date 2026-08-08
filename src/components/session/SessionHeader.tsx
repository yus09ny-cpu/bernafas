import { Hand, RotateCcw, X } from 'lucide-react'

interface SessionHeaderProps {
  bpm: number | null
  isDeviceConnected: boolean
  contactLost: boolean
  sessionActive: boolean
  onEnd: () => void
}

// Floating header shared by all four carousel pages — dark translucent pills
// so the bpm badge and end button stay legible whether the page underneath
// is the light pastel surface (Skrin 1/3/4) or the full-bleed scene photo
// (Skrin 2), without each page having to pick its own contrast-safe colors.
//
// The right-hand button does double duty and swaps its icon to say so: X
// ends the running session (freezes Skrin 4 into a summary, doesn't
// navigate away — the user may still swipe/tap back through 1-3); once
// ended, the same button becomes a refresh icon that starts a new session.
// Same callback either way — SessionScreen decides which action it is.
export default function SessionHeader({ bpm, isDeviceConnected, contactLost, sessionActive, onEnd }: SessionHeaderProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5"
      style={{ paddingTop: 'calc(1rem + var(--safe-top))' }}
    >
      {isDeviceConnected ? (
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
      )}
      <button
        onClick={onEnd}
        aria-label={sessionActive ? 'Tamatkan sesi' : 'Sesi baharu'}
        className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-transform active:scale-90"
      >
        {sessionActive ? <X size={18} /> : <RotateCcw size={16} />}
      </button>
    </div>
  )
}
