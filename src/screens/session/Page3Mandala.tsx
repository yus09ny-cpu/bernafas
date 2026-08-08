import SegmentedCoherenceRing from '@/components/session/SegmentedCoherenceRing'
import FlowerBloom from '@/components/session/FlowerBloom'
import CoachingPrompts from '@/components/session/CoachingPrompts'
import type { LiveSessionData } from './types'

// Skrin 3 — same segmented ring as Skrin 1, but the center is an animated
// flower bloom (fullness/color track live coherence) instead of the pulse
// dot, with rotating BM coaching prompts underneath.
export default function Page3Mandala({ data }: { data: LiveSessionData }) {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-between px-6"
      style={{
        paddingTop: 'calc(4.5rem + var(--safe-top))',
        paddingBottom: 'calc(var(--nav-height) + 4rem + var(--safe-bottom))',
      }}
    >
      <span />

      <SegmentedCoherenceRing history={data.history} elapsedSec={data.elapsedSec} size={260}>
        <FlowerBloom coherence={data.coherenceLive} phase={data.phase} phaseDurationMs={data.phaseDurationMs} size={190} />
      </SegmentedCoherenceRing>

      <CoachingPrompts running={data.sessionActive} />
    </div>
  )
}
