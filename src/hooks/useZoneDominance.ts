import { useEffect, useRef, useState } from 'react'
import { getCoherenceZone } from '@/lib/coherenceZones'
import { SEGMENT_COUNT, type Zone } from '@/components/session/SegmentedRing'

// Zone-DOMINANCE tally (HeartMath Inner Balance–style), not a time-locked
// history — every real second (elapsedSec ticks once/sec in
// useHrvSession.ts) is credited to whichever zone the given live coherence
// value was in at that moment; the returned `zones` array is recomputed
// from the *running proportions* of that tally on every tick, not appended
// to. A session that's spent 70% of its time so far in 'high' will always
// show ~70% of the 36 ticks as green, redistributed live as the ratio
// shifts — there's no concept of an individual tick "belonging" to a past
// moment.
//
// Fixed low->medium->high layout order (not reordered by which zone
// currently dominates) so the ring doesn't reshuffle position as ratios
// change, only grow/shrink each arc in place — SegmentedRing.tsx turns this
// zones[] array into the actual grouped-arc rendering with gaps.
//
// Formula-agnostic: `coherenceLive` here is whatever live 0-1 score the
// caller is driving its ring from — Skrin 1 passes coherenceLiveAlt (its
// A/B-test formula), Skrin 2 passes the original coherenceLive
// (computeCoherence), so the ring/flower on Skrin 2 stay color-consistent
// without pulling that Skrin-1-only experiment along with them.
//
// Time not yet classified (value still null — before the first accepted
// beat of the session) isn't credited to any zone; while zero seconds are
// tallied at all, this returns 36 'idle' entries.
export function useZoneDominance(elapsedSec: number, coherenceLive: number | null): Zone[] {
  const secondsRef = useRef({ low: 0, medium: 0, high: 0 })
  const lastElapsedRef = useRef(0)
  const coherenceRef = useRef(coherenceLive)
  coherenceRef.current = coherenceLive
  const [, bump] = useState(0)

  useEffect(() => {
    const delta = elapsedSec - lastElapsedRef.current
    lastElapsedRef.current = elapsedSec
    if (delta > 0 && coherenceRef.current !== null) {
      secondsRef.current[getCoherenceZone(coherenceRef.current)] += delta
    }
    bump(n => n + 1) // secondsRef itself isn't state — force the re-render this tally update needs
  }, [elapsedSec])

  const { low, medium, high } = secondsRef.current
  const total = low + medium + high
  if (total <= 0) return Array<Zone>(SEGMENT_COUNT).fill('idle')

  // Largest-remainder apportionment — the only rounding method here that's
  // guaranteed to sum back to exactly SEGMENT_COUNT ticks.
  const raw = { low: (low / total) * SEGMENT_COUNT, medium: (medium / total) * SEGMENT_COUNT, high: (high / total) * SEGMENT_COUNT }
  const floor = { low: Math.floor(raw.low), medium: Math.floor(raw.medium), high: Math.floor(raw.high) }
  const remainder = SEGMENT_COUNT - (floor.low + floor.medium + floor.high)
  const byFraction = (['low', 'medium', 'high'] as const)
    .map(z => ({ z, frac: raw[z] - floor[z] }))
    .sort((a, b) => b.frac - a.frac)
  const counts = { ...floor }
  for (let i = 0; i < remainder; i++) counts[byFraction[i]!.z]++

  return [
    ...Array<Zone>(counts.low).fill('low'),
    ...Array<Zone>(counts.medium).fill('medium'),
    ...Array<Zone>(counts.high).fill('high'),
  ]
}
