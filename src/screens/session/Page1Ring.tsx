import { useState } from 'react'
import { HrvGraph } from '@/components/session/HrvGraph'
import { SegmentedRing } from '@/components/session/SegmentedRing'
import { PulsingSphere } from '@/components/session/PulsingSphere'
import { SmoothnessSetting } from '@/components/session/SmoothnessSetting'
import { DeviceConnect } from '@/components/session/DeviceConnect'
import BreathPhaseLabel from '@/components/session/BreathPhaseLabel'
import { getCoherenceZone, ZONE_COLOR } from '@/lib/coherenceZones'
import type { LiveSessionData } from './types'

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
  // `data.zones` is the single shared zone-dominance tally — computed once
  // in SessionScreen.tsx (useZoneDominance off coherenceLiveAlt) and handed
  // to both this page and Page2Mandala, so their rings can never drift
  // apart the way two independent hook instances used to. Ring + sphere
  // color are driven by coherenceLiveAlt (calm-breath-pulse's own
  // frequency-domain formula, "Sumber" below) — now the standardized
  // formula for the ring/flower app-wide (Skrin 1 and 2); Skrin 3/4 still
  // show a few coherenceLive-derived things, flagged but not yet switched
  // (see types.ts). coherenceFromBeats needs ~20-30s of real beats before
  // it returns anything but 0, so the ring/sphere will show red/idle for
  // the first half-minute of every session — expected, not a bug.
  const { zones } = data
  const [smoothness, setSmoothness] = useState(1)
  // Zone-colors the sphere (see PulsingSphere's `color` prop) — same
  // getCoherenceZone/ZONE_COLOR pipeline as the ring segments and as
  // Bernafas's own PulseDot on Skrin 2, so all three agree on what "red"
  // looks like.
  const zone = data.coherenceLiveAlt !== null ? getCoherenceZone(data.coherenceLiveAlt) : null
  // "Mengkalibrasi…" overrides the phase label + subtitle for the ~20-30s
  // window where coherenceLiveAlt is a non-null 0 (coherenceFromBeats'
  // floor) rather than a real reading — contactLost takes priority since
  // that's a more urgent, different message. See BreathPhaseLabel.tsx.
  const calibrating = data.coherenceLiveAlt !== null && !data.coherenceAltReady && !data.contactLost

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
          <BreathPhaseLabel
            phase={data.phase}
            calibrating={calibrating}
            subtitle={
              data.contactLost
                ? 'Tiada bacaan — letak jari pada sensor'
                : data.coherenceLiveAlt !== null
                ? `Skor live: ${Math.round(data.coherenceLiveAlt * 100)}`
                : data.isDeviceConnected
                ? 'Mengumpul bacaan HRV...'
                : 'Ikut bulatan — kembang saat tarik, kecut saat hembus'
            }
          />
          {/* TEMP — Skrin-1-only A/B comparison reference. Stays visible
              during calibration too — computeCoherence doesn't share
              coherenceFromBeats' data floor, so it's already a real reading
              by then. Remove once the formula question is fully settled —
              see src/lib/coherence.ts. */}
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
