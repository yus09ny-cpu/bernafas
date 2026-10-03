import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SegmentedRing, SEGMENT_COUNT, type Zone } from '@/components/session/SegmentedRing'
import { PulsingSphere } from '@/components/session/PulsingSphere'
import WhmVideoCard from '@/components/session/WhmVideoCard'
import { useLocalZoneDominance } from '@/hooks/useLocalZoneDominance'
import { getCoherenceZone, ZONE_COLOR, type CoherenceZone } from '@/lib/coherenceZones'
import { RING_SIZE_MAX } from '@/hooks/useRingSize'
import { WHM_CUES, type WhmCue, type WhmCuePhase } from '@/data/whmCues'
import type { LiveSessionData } from './types'

// Replaces the old cue-phase label (2026-10-03) — this text now tracks live
// coherence, not the video. Same zone the sphere's own colour already reads
// (getCoherenceZone's three bands — low/medium/high, nothing else), so
// wording and sphere colour can never disagree about what's being shown.
const ZONE_FEEDBACK: Record<CoherenceZone, string> = {
  low: 'Teruskan bernafas',
  medium: 'Bagus, teruskan',
  high: 'Anda koheren — tenang & sejahtera',
}
const ZONE_HOLD_MS = 3000
const ZONE_FADE_MS = 300

// Only commits a new zone to display after it's been the live zone
// continuously for ZONE_HOLD_MS — a zone that flips back before the timer
// fires just cancels it (effect cleanup), never reaching the screen. Null
// (no sensor data / calibrating floor / before play) debounces exactly the
// same way, so going idle also waits out the hold before the text hides.
function useDebouncedZone(zone: CoherenceZone | null, delayMs: number): CoherenceZone | null {
  const [debounced, setDebounced] = useState(zone)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(zone), delayMs)
    return () => window.clearTimeout(id)
  }, [zone, delayMs])
  return debounced
}

// Sphere animation only understands two states ('in'/'out', PulsingSphere.tsx
// — shared with Skrin 1, not modified). 'tarik' and 'pulih' are both
// inhale-shaped (pulih = the recovery breath after a hold), so both map to
// 'in'; 'tahan' has no third state to map to, see HOLD_DURATION_INFLATE below.
function breathDirectionForPhase(phase: WhmCuePhase): 'in' | 'out' {
  return phase === 'hembus' ? 'out' : 'in'
}

// Index of the cue active at time `t` — the last cue whose own `t` is
// `<= t`. Pure function of (cues, t), not incremental state, which is what
// makes seeking/looping/replaying "just work": whatever `t` the Vimeo
// Player API reports next (a normal tick, a scrub, a loop back to 0) is
// looked up fresh, never derived from "what cue came before this one".
function activeCueIndexAt(cues: WhmCue[], t: number): number {
  let idx = 0
  for (let i = 0; i < cues.length; i++) {
    if (cues[i]!.t <= t) idx = i
    else break
  }
  return idx
}

// 'tahan' (hold) has no expand/contract of its own — the sphere should just
// stay wherever it was. PulsingSphere has no "frozen" state in its own API
// (continuous sine cycle, shared with Skrin 1, not modified), so this
// inflates the declared phaseDurationMs during a hold far beyond the hold's
// real length — the same real elapsed seconds then cover only a tiny sliver
// of the (much longer) declared cycle, which reads as visually still.
const HOLD_DURATION_INFLATE = 12

// Walks backward from `index` past any run of 'tahan' cues to find the last
// real breath direction to freeze on — not just the immediately preceding
// cue, in case the recorder ever produces two 'tahan' entries in a row.
function lastBreathDirectionBefore(cues: WhmCue[], index: number): 'in' | 'out' {
  for (let i = index; i >= 0; i--) {
    if (cues[i]!.phase !== 'tahan') return breathDirectionForPhase(cues[i]!.phase)
  }
  return 'in'
}

// Defensive floor only (not expected to actually bind at the 375x667/390x844
// floors this slide targets — see the measurement effect below) and the
// same ~0.45 PulsingSphere-to-ring ratio Page1Ring itself derives its
// sphere size at (144 at its default 320 ring) — kept in sync by the same
// formula, not a new guess. RING_SIZE_MAX is Skrin 1's own constant
// (useRingSize.ts) reused only as a sanity ceiling against pathological
// viewports (tablets/desktop) — read-only import, doesn't touch Skrin 1.
const RING_SIZE_FLOOR = 100
const RING_TO_SPHERE_RATIO = 0.45
// Gap between the ring and the revealed label/reset-button block beneath it.
const RING_LABEL_GAP = 8

const IDLE_ZONES: Zone[] = Array<Zone>(SEGMENT_COUNT).fill('idle')

// Skrin 2 — rebuilt around the WHM video (2026-10-02). The ring is Skrin 1's
// own SegmentedRing+PulsingSphere pairing, reused as-is (not a copy), driven
// by a LOCAL zone-dominance tally (useLocalZoneDominance) instead of the
// shared session-long one `data.zones` — per product-owner decision, this
// ring should only reflect coherence from the moment the video is first
// played, not mixed with whatever happened earlier in the session. Skrin 1
// itself is untouched and keeps reading the shared session-long tally.
//
// Before first play: a plain idle (all-grey) ring, no center sphere, no
// phase label — purely decorative, reads no live data. The moment the user
// taps play, the real ring+sphere mounts and the local tally starts
// accumulating; pausing/replaying the VIDEO never hides it again or resets
// it (only the explicit "Mula semula" button does, since a clean "did the
// user replay from 0" signal isn't available from a bare player.vimeo.com
// iframe without wiring Vimeo's own postMessage player API).
//
// Ring size is measured, not a fixed constant (2026-10-02) — the ring sits
// directly under the video with a small fixed gap, and fills whatever
// vertical (or horizontal, whichever is smaller) space is actually left on
// the screen, so it reads as "as large as fits" on both a 375x667 floor and
// a taller 390x844 phone instead of the same fixed px on both.
export default function Page2Mandala({ data, isActive }: { data: LiveSessionData; isActive: boolean }) {
  const [hasPlayed, setHasPlayed] = useState(false)
  const { zones: localZones, reset } = useLocalZoneDominance(hasPlayed, data.elapsedSec, data.coherenceLiveAlt)

  const zone = data.coherenceLiveAlt !== null ? getCoherenceZone(data.coherenceLiveAlt) : null

  // Held for ZONE_HOLD_MS before changing (anti-flicker), then cross-faded
  // over ZONE_FADE_MS: displayZone only updates once stableZone has already
  // settled AND the current text has fully faded out, so the swap never
  // happens mid-fade.
  const stableZone = useDebouncedZone(zone, ZONE_HOLD_MS)
  const [displayZone, setDisplayZone] = useState<CoherenceZone | null>(null)
  const [zoneTextVisible, setZoneTextVisible] = useState(true)
  useEffect(() => {
    if (stableZone === displayZone) return
    setZoneTextVisible(false)
    const id = window.setTimeout(() => {
      setDisplayZone(stableZone)
      setZoneTextVisible(true)
    }, ZONE_FADE_MS)
    return () => window.clearTimeout(id)
  }, [stableZone, displayZone])

  // Cue-driven sphere timing (2026-10-02) — replaces data.phase/
  // data.phaseDurationMs (the shared useBreathingPacer, untouched) for this
  // slide only. currentTimeSec is pushed up from WhmVideoCard's Vimeo
  // Player wiring. The setter (not the value) is all this component needs
  // from Vimeo's play/pause/ended state (2026-10-03) — the feedback text
  // below tracks live coherence now, not video playback state, so pausing
  // the video no longer hides it the way the old cue label used to.
  const [currentTimeSec, setCurrentTimeSec] = useState(0)
  const [, setIsPlaybackActive] = useState(false)

  const cueIndex = activeCueIndexAt(WHM_CUES, currentTimeSec)
  const activeCue = WHM_CUES[cueIndex]!
  const nextCue = WHM_CUES[cueIndex + 1]
  const cueDurationMs = (nextCue ? nextCue.t - activeCue.t : 5) * 1000
  const spherePhase = activeCue.phase === 'tahan' ? lastBreathDirectionBefore(WHM_CUES, cueIndex - 1) : breathDirectionForPhase(activeCue.phase)
  const spherePhaseDurationMs = activeCue.phase === 'tahan' ? cueDurationMs * HOLD_DURATION_INFLATE : cueDurationMs

  const boxRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const [ringSize, setRingSize] = useState(RING_SIZE_FLOOR)

  // Keyed on [hasPlayed, displayZone], NOT re-created on every render — an
  // earlier version re-ran this effect (and its ResizeObserver) on every
  // render with no dependency array, which hit a real "Maximum update depth
  // exceeded" crash: committing a new ringSize changes the DOM, the
  // observer fires again, the effect (which also reruns post-render)
  // recomputes and commits again, forever. displayZone is included because
  // the feedback text's own line count (1 line for the short zones, 2 for
  // the longer "high" message) changes the label block's real height — the
  // ResizeObserver below watches `box`, not `labelRef`, and box's own
  // flex-1 size doesn't change just because a child's content height did,
  // so without this the ring could stay sized for whichever zone text
  // happened to be showing when hasPlayed first flipped true. displayZone
  // only changes a few times a minute at most (it's already debounced+faded
  // above), nowhere near the render-every-tick case that caused the actual
  // infinite loop, so adding it here is safe. The epsilon-guarded setState
  // (skip committing a value within 1px of the current one) is the other
  // half of that original fix — the ResizeObserver callback itself still
  // fires independently of React's render cycle for any later real box
  // resize (window resize, rotation).
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const recompute = () => {
      const boxRect = box.getBoundingClientRect()
      const labelHeight = labelRef.current?.offsetHeight ?? 0
      const reserved = labelHeight > 0 ? labelHeight + RING_LABEL_GAP : 0
      const available = Math.min(boxRect.width, boxRect.height - reserved)
      const next = Math.floor(Math.max(RING_SIZE_FLOOR, Math.min(RING_SIZE_MAX, available)))
      setRingSize(prev => (Math.abs(prev - next) > 1 ? next : prev))
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(box)
    return () => ro.disconnect()
  }, [hasPlayed, displayZone])

  const sphereSize = Math.round(ringSize * RING_TO_SPHERE_RATIO)

  return (
    <div
      className="flex h-full w-full flex-col items-center gap-3 px-6"
      style={{
        paddingTop: 'calc(4rem + var(--safe-top))',
        // +4rem (not a smaller buffer) — this specifically clears the
        // floating dot-indicator pill (SessionCarousel.tsx positions it at
        // `bottom: calc(var(--nav-height) + 0.875rem + ...)`, ~40px tall),
        // not just the nav bar itself. A smaller buffer tried earlier let
        // the ring (now measured to fill available space, so it reaches
        // much further down than the old fixed 160px one did) push the
        // "Mula semula" button behind that pill — same reason Page1Ring
        // uses this exact value.
        paddingBottom: 'calc(var(--nav-height) + 4rem + var(--safe-bottom))',
      }}
    >
      <WhmVideoCard
        isActive={isActive}
        onPlay={() => setHasPlayed(true)}
        onTimeUpdate={setCurrentTimeSec}
        onPlaybackStateChange={setIsPlaybackActive}
      />

      <div ref={boxRef} className="flex w-full flex-1 flex-col items-center justify-start">
        <div className="flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
          {hasPlayed ? (
            <SegmentedRing zones={localZones} size={ringSize}>
              <PulsingSphere
                phase={spherePhase}
                phaseDurationMs={spherePhaseDurationMs}
                bpm={data.bpm ?? 0}
                smoothness={1}
                color={zone ? ZONE_COLOR[zone] : undefined}
                size={sphereSize}
              />
            </SegmentedRing>
          ) : (
            <SegmentedRing zones={IDLE_ZONES} size={ringSize} />
          )}
        </div>

        {hasPlayed && (
          <div ref={labelRef} className="flex flex-col items-center gap-2" style={{ marginTop: RING_LABEL_GAP }}>
            {displayZone && (
              <span
                className="max-w-[260px] text-center text-base font-semibold transition-opacity"
                style={{ opacity: zoneTextVisible ? 1 : 0, transitionDuration: `${ZONE_FADE_MS}ms`, color: ZONE_COLOR[displayZone] }}
              >
                {ZONE_FEEDBACK[displayZone]}
              </span>
            )}
            <button
              type="button"
              onClick={reset}
              className="text-[11px] text-[var(--color-text-muted)] underline-offset-4 hover:underline"
            >
              Mula semula
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
