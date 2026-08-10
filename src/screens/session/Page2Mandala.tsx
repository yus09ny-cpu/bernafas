import { HrvGraph } from '@/components/session/HrvGraph'
import { SegmentedRing } from '@/components/session/SegmentedRing'
import FlowerBloom from '@/components/session/FlowerBloom'
import CoachingPrompts from '@/components/session/CoachingPrompts'
import BreathPhaseLabel from '@/components/session/BreathPhaseLabel'
import type { LiveSessionData } from './types'

// Ring size for this page specifically — bigger than Skrin 1's default 320
// (SegmentedRing's `size` prop), because FlowerBloom's petals reach much
// further from center than PulsingSphere does for the same nominal size,
// and its breath animation now shares Skrin 1's full 1.4x/0.7x swing (see
// PulseDot/FlowerBloom's breath-scale fix). At the true worst case — max
// coherence (fullness=1.0) at the exact peak of an inhale (breathScale=1.4)
// happening simultaneously — the numbers work out to:
//   ring inner edge  = 330*0.43125 - (330*0.05625)/2           ≈ 133.0px
//   flower max reach = (130/2 * 0.85) * 1.55 * 1.4              ≈ 119.9px
//   clearance                                                   ≈  13.1px
// Re-check both numbers together if either FLOWER_SIZE, RING_SIZE, or
// FlowerBloom's own fullness/reach formula ever changes.
const RING_SIZE = 330
const FLOWER_SIZE = 130

// Skrin 2 — moved here from Skrin 3 (scene/photo page now sits at Skrin 3
// instead). Same zone-dominance ring as Skrin 1 (SegmentedRing, swapped in
// from the older time-locked SegmentedCoherenceRing this page used before),
// but the center is an animated flower bloom (fullness/color track live
// coherence) instead of the pulse sphere, with rotating BM coaching prompts
// underneath.
//
// `data.zones` is the SAME shared tally Page1Ring reads (computed once in
// SessionScreen.tsx) — not a second independent useZoneDominance call. Two
// separate calls here used to each run their own tally off their own
// effect, which could (and did) drift out of sync with Skrin 1's ring even
// when superficially "the same" formula; reading one shared array is what
// actually guarantees identical ring state at every instant.
//
// FlowerBloom's coherence prop now reads coherenceLiveAlt too (standardized
// alongside the ring, not just for it) — coherenceLive stays computed and
// available, just no longer drives anything visible on this page.
export default function Page2Mandala({ data }: { data: LiveSessionData }) {
  // Same calibration override as Skrin 1/3 — see BreathPhaseLabel.tsx and
  // useHrvSession.ts's coherenceAltReady.
  const calibrating = data.coherenceLiveAlt !== null && !data.coherenceAltReady && !data.contactLost
  // No numeric score line here (unlike Skrin 1) — the flower's own
  // fullness/color and the ring already are the live score display; a
  // second number would just duplicate that.
  const subtitle = data.contactLost
    ? 'Tiada bacaan — letak jari pada sensor'
    : data.coherenceLiveAlt === null && data.isDeviceConnected
    ? 'Mengumpul bacaan HRV...'
    : undefined

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-between px-6"
      style={{
        paddingTop: 'calc(4.5rem + var(--safe-top))',
        paddingBottom: 'calc(var(--nav-height) + 4rem + var(--safe-bottom))',
      }}
    >
      <HrvGraph beats={data.beats} />

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <SegmentedRing zones={data.zones} size={RING_SIZE}>
          <FlowerBloom coherence={data.coherenceLiveAlt} phase={data.phase} phaseDurationMs={data.phaseDurationMs} size={FLOWER_SIZE} />
        </SegmentedRing>

        <BreathPhaseLabel phase={data.phase} calibrating={calibrating} subtitle={subtitle} />
      </div>

      <CoachingPrompts running={data.sessionActive} />
    </div>
  )
}
