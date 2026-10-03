import { useCallback, useEffect, useRef, useState } from 'react'
import { getCoherenceZone } from '@/lib/coherenceZones'
import { SEGMENT_COUNT, type Zone } from '@/components/session/SegmentedRing'

// Skrin 2-only, local mirror of useZoneDominance.ts's own algorithm — same
// "credit the real elapsed second to whichever zone the live score was in"
// tally, same largest-remainder apportionment into 36 ticks — but counting
// from WHM video play onwards instead of from session start, so the ring on
// this slide shows only how coherence moved during the practice, not mixed
// with whatever happened earlier in the session. Deliberately a separate
// accumulator rather than touching useZoneDominance.ts itself, which Skrin 1
// still reads unmodified.
export function useLocalZoneDominance(active: boolean, elapsedSec: number, coherenceLive: number | null): { zones: Zone[]; reset: () => void } {
  const secondsRef = useRef({ low: 0, medium: 0, high: 0 })
  const lastElapsedRef = useRef(elapsedSec)
  const coherenceRef = useRef(coherenceLive)
  coherenceRef.current = coherenceLive
  const [, bump] = useState(0)

  useEffect(() => {
    if (!active) {
      // Keep the baseline current while dormant so a later activation isn't
      // credited a lump sum for the time it wasn't actually running.
      lastElapsedRef.current = elapsedSec
      return
    }
    const delta = elapsedSec - lastElapsedRef.current
    lastElapsedRef.current = elapsedSec
    if (delta > 0 && coherenceRef.current !== null) {
      secondsRef.current[getCoherenceZone(coherenceRef.current)] += delta
    }
    bump(n => n + 1)
  }, [active, elapsedSec])

  const reset = useCallback(() => {
    secondsRef.current = { low: 0, medium: 0, high: 0 }
    lastElapsedRef.current = elapsedSec
    bump(n => n + 1)
  }, [elapsedSec])

  const { low, medium, high } = secondsRef.current
  const total = low + medium + high
  if (total <= 0) return { zones: Array<Zone>(SEGMENT_COUNT).fill('idle'), reset }

  const raw = { low: (low / total) * SEGMENT_COUNT, medium: (medium / total) * SEGMENT_COUNT, high: (high / total) * SEGMENT_COUNT }
  const floor = { low: Math.floor(raw.low), medium: Math.floor(raw.medium), high: Math.floor(raw.high) }
  const remainder = SEGMENT_COUNT - (floor.low + floor.medium + floor.high)
  const byFraction = (['low', 'medium', 'high'] as const)
    .map(z => ({ z, frac: raw[z] - floor[z] }))
    .sort((a, b) => b.frac - a.frac)
  const counts = { ...floor }
  for (let i = 0; i < remainder; i++) counts[byFraction[i]!.z]++

  return {
    zones: [
      ...Array<Zone>(counts.low).fill('low'),
      ...Array<Zone>(counts.medium).fill('medium'),
      ...Array<Zone>(counts.high).fill('high'),
    ],
    reset,
  }
}
