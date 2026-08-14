import { useCallback, useState } from 'react'

// Skrin 1's ring+pulse-dot size preference — same lightweight localStorage
// pattern as useSceneImage.ts (no auth/database for per-user prefs yet):
// read once on init, write through on every change, swallow storage errors
// (private browsing / quota) rather than throwing.
const STORAGE_KEY = 'bernafas.ringSize.v1'

// Bounds are deliberately narrower than "whatever fits" — RING_SIZE_MAX is
// the largest value confirmed via the same Playwright getBoundingClientRect()
// sweep used for the graph/ring/label gap fixes (400-900px viewport height,
// 390px width) to still hold >=10px on every gap; RING_SIZE_MIN is a
// legibility floor, well above SegmentedRing's own emergency-squeeze
// min-h-[110px] (that one's for surviving an impossibly short viewport, not
// a comfortable user choice). Never let the slider bypass these — the ring
// wrapper's max-height is driven by this same clamped value, so going past
// RING_SIZE_MAX is exactly what would reopen the overlap this whole
// investigation chain fixed.
export const RING_SIZE_MIN = 200
export const RING_SIZE_MAX = 360
export const RING_SIZE_DEFAULT = 320

function clamp(n: number): number {
  return Math.min(RING_SIZE_MAX, Math.max(RING_SIZE_MIN, n))
}

function readStored(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const n = raw !== null ? Number(raw) : NaN
    return Number.isFinite(n) ? clamp(n) : RING_SIZE_DEFAULT
  } catch {
    return RING_SIZE_DEFAULT
  }
}

export function useRingSize() {
  const [ringSize, setRingSizeState] = useState<number>(readStored)

  const setRingSize = useCallback((next: number) => {
    const clamped = clamp(next)
    setRingSizeState(clamped)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped))
    } catch {
      // Most likely private-browsing/storage-disabled — the size still
      // applies live for this session, it just won't persist across reloads.
    }
  }, [])

  return { ringSize, setRingSize }
}
