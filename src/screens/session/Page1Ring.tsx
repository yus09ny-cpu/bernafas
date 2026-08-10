import { useEffect, useRef, useState } from 'react'
import { HrvGraph } from '@/components/session/HrvGraph'
import { SegmentedRing, SEGMENT_COUNT, type Zone } from '@/components/session/SegmentedRing'
import { PulsingSphere } from '@/components/session/PulsingSphere'
import { SmoothnessSetting } from '@/components/session/SmoothnessSetting'
import { DeviceConnect } from '@/components/session/DeviceConnect'
import { getCoherenceZone, ZONE_COLOR } from '@/lib/coherenceZones'
import type { LiveSessionData } from './types'

const PHASE_LABEL: Record<'in' | 'out', string> = {
  in: 'Tarik Nafas',
  out: 'Hembus Nafas',
}

// Zone-DOMINANCE tally for the ring (HeartMath Inner Balance–style), not a
// time-locked history — replaces the earlier "each segment locks in the
// zone it had when reached" design entirely. Every real second (elapsedSec
// ticks once/sec in useHrvSession.ts) is credited to whichever zone
// coherenceLiveAlt was in at that moment; `zones` below is recomputed from
// the *running proportions* of that tally on every tick, not appended to.
// A session that's spent 70% of its time so far in 'high' will always show
// ~70% of the 36 ticks as green, redistributed live as the ratio shifts —
// there's no concept of an individual tick "belonging" to a past moment.
//
// Fixed low->medium->high layout order (not reordered by which zone
// currently dominates) so the ring doesn't reshuffle position as ratios
// change, only grow/shrink each arc in place — SegmentedRing.tsx turns
// this zones[] array into the actual grouped-arc rendering with gaps.
//
// Time not yet classified (coherenceLiveAlt still null — before the first
// accepted beat of the session) isn't credited to any zone; while zero
// seconds are tallied at all, this returns 36 'idle' entries.
function useZoneDominance(elapsedSec: number, coherenceLiveAlt: number | null): Zone[] {
  const secondsRef = useRef({ low: 0, medium: 0, high: 0 })
  const lastElapsedRef = useRef(0)
  const coherenceRef = useRef(coherenceLiveAlt)
  coherenceRef.current = coherenceLiveAlt
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

// Skrin 1 — ported wholesale from calm-breath-pulse's session screen
// (SegmentedRing + PulsingSphere + HrvGraph + SmoothnessSetting +
// DeviceConnect, all copied as-is). Two adaptations from a literal port:
//  1. This stays a props-driven component (`data: LiveSessionData`) instead
//     of calling useHrvSession()/useBreathingPacer() itself — Bernafas calls
//     those hooks exactly once, in SessionScreen.tsx, so all four carousel
//     pages share one live BLE connection instead of each opening their own.
//  2. The bpm badge and the X/end-session button aren't repeated here — the
//     floating SessionHeader (shared by all 4 pages) already renders both;
//     duplicating them would just stack two of the same control.
// Everything else — the ring/sphere visuals, the WAAPI animations, the
// smoothness setting, the device-connect affordance — is unedited.
export default function Page1Ring({ data }: { data: LiveSessionData }) {
  // Ring + sphere color are driven by coherenceLiveAlt (calm-breath-pulse's
  // own frequency-domain formula, "Sumber" below) rather than Bernafas's
  // computeCoherence — per the ongoing A/B comparison, this is the formula
  // being evaluated for Skrin 1 specifically. Nothing else in the app
  // changes: Skrin 2/3/4, sessionStats.ts, and the achievement/summary
  // calculations all still read coherenceLive (computeCoherence) exactly as
  // before. coherenceFromBeats needs ~20-30s of real beats before it
  // returns anything but 0, so the ring/sphere will show red/idle for the
  // first half-minute of every session — expected, not a bug.
  const zones = useZoneDominance(data.elapsedSec, data.coherenceLiveAlt)
  const [smoothness, setSmoothness] = useState(1)
  // Zone-colors the sphere (see PulsingSphere's `color` prop) — same
  // getCoherenceZone/ZONE_COLOR pipeline as the ring segments and as
  // Bernafas's own PulseDot on Skrin 2, so all three agree on what "red"
  // looks like.
  const zone = data.coherenceLiveAlt !== null ? getCoherenceZone(data.coherenceLiveAlt) : null

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-between px-6"
      style={{
        paddingTop: 'calc(4.5rem + var(--safe-top))',
        paddingBottom: 'calc(var(--nav-height) + 4rem + var(--safe-bottom))',
      }}
    >
      <div className="flex w-full flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <DeviceConnect device={data.device} />
          <SmoothnessSetting value={smoothness} onChange={setSmoothness} />
        </div>
        <span className="pr-1 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          {data.simulated ? 'Tanpa peranti' : 'Data langsung'}
        </span>
      </div>

      <HrvGraph beats={data.beats} />

      <section className="flex flex-1 flex-col items-center justify-center gap-8">
        <SegmentedRing zones={zones}>
          <PulsingSphere
            phase={data.phase}
            phaseDurationMs={data.phaseDurationMs}
            bpm={data.bpm ?? 0}
            smoothness={smoothness}
            color={zone ? ZONE_COLOR[zone] : undefined}
          />
        </SegmentedRing>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold tracking-wide text-[var(--color-primary-dark)]">{PHASE_LABEL[data.phase]}</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {data.contactLost
              ? 'Tiada bacaan — letak jari pada sensor'
              : data.coherenceLiveAlt !== null
              ? `Skor live: ${Math.round(data.coherenceLiveAlt * 100)}`
              : data.isDeviceConnected
              ? 'Mengumpul bacaan HRV...'
              : 'Ikut bulatan — kembang saat tarik, kecut saat hembus'}
          </span>
          {/* TEMP — Skrin-1-only A/B comparison. The ring/sphere/"Skor live"
              above are all now driven by coherenceLiveAlt (calm-breath-pulse's
              frequency-domain formula, labeled "Sumber" would be redundant
              with the score already shown above — this row is just the
              secondary RMSSD reference for comparison). Remove once the
              formula question is settled — see src/lib/coherence.ts. */}
          <span
            className="mt-0.5 text-[10px] tabular-nums text-[var(--color-text-muted)]"
            style={{ color: data.coherenceLive !== null ? ZONE_COLOR[getCoherenceZone(data.coherenceLive)] : undefined }}
          >
            Rujukan RMSSD: {data.coherenceLive !== null ? Math.round(data.coherenceLive * 100) : '—'}
          </span>
        </div>
      </section>

      <span className="text-xs text-[var(--color-text-muted)]">Nafas ke-{data.breathCount}</span>
    </div>
  )
}
