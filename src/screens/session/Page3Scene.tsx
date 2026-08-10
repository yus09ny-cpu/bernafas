import { HrvGraph } from '@/components/session/HrvGraph'
import PulseDot from '@/components/session/PulseDot'
import SceneBackground from '@/components/session/SceneBackground'
import SceneImagePicker from '@/components/session/SceneImagePicker'
import BreathPhaseLabel from '@/components/session/BreathPhaseLabel'
import { useSceneImage } from '@/hooks/useSceneImage'
import { getCoherenceZone } from '@/lib/coherenceZones'
import type { LiveSessionData } from './types'

// Skrin 3 — moved here from Skrin 2 (mandala/flower now sits at Skrin 2
// instead). Same real HRV tachogram (HrvGraph, not the old stylized
// PulseWaveform strip this page used before) + dot as Skrin 1/2, no ring,
// over a full-bleed calming background. The background is either the
// generated abstract scene (SceneBackground's default) or a photo the user
// uploaded themselves via SceneImagePicker — see useSceneImage.ts for the
// (temporary, localStorage-based) persistence.
export default function Page3Scene({ data }: { data: LiveSessionData }) {
  // PulseDot's zone color is a distinct, deliberately-untouched call site —
  // still coherenceLive, not the standardized coherenceLiveAlt (see
  // types.ts). The calibration message below is unrelated to that choice:
  // it's tied specifically to coherenceFromBeats' own data floor, which
  // only coherenceLiveAlt has, so it uses that regardless of what colors
  // the dot.
  const zone = data.coherenceLive !== null ? getCoherenceZone(data.coherenceLive) : null
  const calibrating = data.coherenceLiveAlt !== null && !data.coherenceAltReady && !data.contactLost
  // No numeric score here either (matches this page's original "no
  // numbers, no labels, just the visual" character) — just enough status
  // text to explain an idle dot.
  const subtitle = data.contactLost
    ? 'Tiada bacaan — letak jari pada sensor'
    : data.coherenceLiveAlt === null && data.isDeviceConnected
    ? 'Mengumpul bacaan HRV...'
    : undefined
  const scene = useSceneImage()

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-between px-6">
      <SceneBackground imageDataUrl={scene.imageDataUrl} />

      <div style={{ paddingTop: 'calc(4.5rem + var(--safe-top))' }} className="flex w-full flex-col gap-3">
        <div className="flex justify-end">
          <SceneImagePicker
            hasImage={scene.imageDataUrl !== null}
            isProcessing={scene.isProcessing}
            error={scene.error}
            onPick={scene.setImage}
            onClear={scene.clearImage}
          />
        </div>
        <HrvGraph beats={data.beats} color="#ffffff" />
      </div>

      <div className="flex flex-col items-center gap-6">
        <PulseDot phase={data.phase} phaseDurationMs={data.phaseDurationMs} bpm={data.bpm} zone={zone} size={150} />
        <BreathPhaseLabel phase={data.phase} calibrating={calibrating} subtitle={subtitle} onDark />
      </div>

      <span
        className="text-xs font-medium text-white"
        style={{ paddingBottom: 'calc(var(--nav-height) + 4rem + var(--safe-bottom))', textShadow: '0 1px 6px rgba(0,0,0,0.25)' }}
      >
        Nafas ke-{data.cycleCount + 1}
      </span>
    </div>
  )
}
