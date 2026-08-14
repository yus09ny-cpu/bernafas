import { HrvGraph } from '@/components/session/HrvGraph'
import { SegmentedRing } from '@/components/session/SegmentedRing'
import { PulsingSphere } from '@/components/session/PulsingSphere'
import BreathPhaseLabel from '@/components/session/BreathPhaseLabel'
import { getCoherenceZone, ZONE_COLOR } from '@/lib/coherenceZones'
import { RING_SIZE_DEFAULT } from '@/hooks/useRingSize'
import type { LiveSessionData } from './types'

// PulsingSphere defaults to 144px (its own original fixed size) — scale it
// proportionally with the chosen ring size so "the ring and the dot" move
// together as one group, per the ring-size setting's own framing, instead
// of the ring resizing around a dot that stays a constant size.
const SPHERE_SIZE_AT_DEFAULT_RING = 144

// Skrin 1 — ported wholesale from calm-breath-pulse's session screen
// (SegmentedRing + PulsingSphere + HrvGraph + SmoothnessSetting +
// DeviceConnect, all copied as-is). Adaptations from a literal port:
//  1. This stays a props-driven component (`data: LiveSessionData`) instead
//     of calling useHrvSession()/useBreathingPacer() itself — Bernafas calls
//     those hooks exactly once, in SessionScreen.tsx, so all four carousel
//     pages share one live BLE connection instead of each opening their own.
//  2. The bpm badge, X/end-session button, DeviceConnect pill, and
//     SmoothnessSetting icon aren't rendered here — the floating
//     SessionHeader (shared by all 4 pages) renders all four in one row
//     when `page1` extras are passed to it (SessionCarousel.tsx), which is
//     why `smoothness` arrives as a prop instead of this component owning
//     that state itself. This used to be a second header row Page1Ring drew
//     on its own below SessionHeader — folded into SessionHeader's single
//     row instead, reclaiming that whole row's height (verified via the
//     same Playwright sweep as the graph/ring gap fix, see paddingTop below).
export default function Page1Ring({ data, smoothness, ringSize }: { data: LiveSessionData; smoothness: number; ringSize: number }) {
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
      // gap-2.5 (10px): `justify-between` alone only distributes space when
      // the column has slack — under a short-viewport squeeze it collapses
      // to 0, which is exactly how the graph and the ring ended up touching
      // edge-to-edge with no breathing room (confirmed via Playwright
      // getBoundingClientRect() sweep, 400-900px). `gap` guarantees this
      // floor regardless of squeeze, while still letting justify-between add
      // more on top of it once there's real slack — see the sweep numbers
      // in the commit message.
      className="flex h-full w-full flex-col items-center justify-between gap-2.5 px-6"
      style={{
        // Was calc(4.5rem + safe-top) — sized to clear SessionHeader's row
        // PLUS this page's own second row (now removed, folded into
        // SessionHeader — see the comment above) plus the gap between them.
        // Now only needs to clear SessionHeader's single row, same as
        // Skrin 2-4 already do at their own calc(4.5rem + ...) — but
        // Skrin 1's row is now visually taller than theirs (device pill +
        // smoothness icon share the row), so this stays its own value
        // rather than just copying theirs; re-verified via the same
        // Playwright sweep as the graph/ring gap fix.
        paddingTop: 'calc(4.25rem + var(--safe-top))',
        paddingBottom: 'calc(var(--nav-height) + 4rem + var(--safe-bottom))',
      }}
    >
      <HrvGraph beats={data.beats} />

      {/* min-h-[227px], not min-h-0 (tried first) — plain min-h-0 let the
          outer flex algorithm shrink section below what its own children
          need, and since section itself has no overflow-hidden, that
          shortfall doesn't clip: the label block silently overflowed
          section's box and visually collided with the "Nafas ke-N" sibling
          right after it. This is that true combined floor (ring wrapper's
          110px + gap-4's 16px + the label block's natural 101px = 227px),
          made explicit — keep it in sync with the ring wrapper's min-h and
          this section's own gap below if any of the three change.
          gap-8→gap-4 here too: the first version of this fix (196px ring
          floor, gap-8, nav-only clearance check) still left the RMSSD line
          and "Nafas ke-N" rendering behind the floating page-dot
          indicator's own semi-transparent pill — a stricter, correct
          clearance check is against the dot pill's actual rect, not just
          the bottom nav bar (the dot pill sits well above the nav). */}
      <section className="flex min-h-[227px] flex-1 flex-col items-center justify-center gap-4">
        {/* Capped + genuinely shrinkable, unlike `section` used to be:
            `overflow-hidden` + `min-h-[110px]` makes only THIS wrapper (not
            the label block below, which must stay fully readable) the
            thing that yields; under real pressure the ring/sphere crops
            down to as small as 110px tall before the deficit is allowed to
            spill onto the graph or labels again — see the Playwright sweep
            in the commit message for the before/after per-height numbers.
            maxHeight was a static max-h-80 (320px, matching SegmentedRing's
            own default `size`) — now driven by the user's ringSize
            preference instead (useRingSize.ts), clamped to
            [RING_SIZE_MIN, RING_SIZE_MAX]; that clamp is what keeps a
            larger chosen size from ever re-eating the gap floors this same
            sweep verified, since the wrapper can never grow past
            RING_SIZE_MAX regardless of what's requested. */}
        <div className="flex min-h-[110px] w-full items-center justify-center overflow-hidden" style={{ maxHeight: ringSize }}>
          <SegmentedRing zones={zones} size={ringSize}>
            <PulsingSphere
              phase={data.phase}
              phaseDurationMs={data.phaseDurationMs}
              bpm={data.bpm ?? 0}
              smoothness={smoothness}
              color={zone ? ZONE_COLOR[zone] : undefined}
              size={(SPHERE_SIZE_AT_DEFAULT_RING * ringSize) / RING_SIZE_DEFAULT}
            />
          </SegmentedRing>
        </div>

        {/* shrink-0: this label block must never be the thing that gives up
            space (see the ring wrapper's comment above) — it's the exact
            content the whole point of this fix is to keep visible. */}
        <div className="flex shrink-0 flex-col items-center gap-1">
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
