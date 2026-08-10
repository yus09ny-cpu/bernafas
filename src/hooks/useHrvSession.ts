import { useCallback, useEffect, useRef, useState } from 'react'
import { useHeartRateMonitor, type HeartRateReading, type SensorContactStatus } from '@/hooks/useHeartRateMonitor'
import { computeCoherence, computeRmssdMs } from '@/lib/hrvCoherence'
import { BpmSmoother } from '@/lib/bpmSmoother'
import { IbiArtifactFilter } from '@/lib/ibiArtifactFilter'
import { getCoherenceZone } from '@/lib/coherenceZones'
import { coherenceFromBeats, type Beat } from '@/lib/coherence'
import type { HistoryPoint } from '@/lib/sessionStats'
import type { DeviceStatus, HeartRateDevice } from '@/hooks/useHeartRateDevice'

export type { HistoryPoint }

// How many real R-R intervals feed the *live* on-screen coherence ring.
// Short/responsive on purpose (so the number moves with the breath the user
// just took) — same caveat as Audit Jiwa's live HUD: a ~short rolling window
// is far shorter than the 60s window HRV research validates computeCoherence
// against. Fine for a live "how am I doing right now" glance, not a
// scientific reading — that's what the session average (sessionStats.ts) is for.
const LIVE_WINDOW_SIZE = 8

// How often a sample (coherence + bpm + rmssd) is pushed into `history` — the
// single timeline every carousel page (the segmented ring, the Skrin 4
// charts) reads from. All four session pages are views of this one array,
// not separate data pulls.
const HISTORY_SAMPLE_MS = 3000

// Rolling buffer size for the raw beat-to-beat tachogram (Skrin 1's
// HrvGraph, ported from calm-breath-pulse). 600 accepted beats comfortably
// covers HrvGraph's own 60s rolling window at real-world resting HR.
const BEATS_BUFFER_SIZE = 600

export function useHrvSession() {
  const [sessionActive, setSessionActive] = useState(false)
  const [smoothedBpm, setSmoothedBpm] = useState<number | null>(null)
  const [coherenceLive, setCoherenceLive] = useState<number | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [elapsedSec, setElapsedSec] = useState(0)
  // True the instant a "Sensor Contact Detected" = 0 packet arrives (finger
  // lifted off the sensor) — distinct from hr.state disconnecting (BLE link
  // itself dropping). The device stays connected the whole time; this is a
  // milder, much more common condition (repositioning a finger mid-session).
  const [contactLost, setContactLost] = useState(false)
  // Raw tri-state mirror of the same signal, for consumers (Skrin 1's
  // DeviceConnect) that want the device's own reported state rather than
  // just the derived boolean.
  const [sensorContact, setSensorContact] = useState<SensorContactStatus>('not_supported')
  // Real beat-to-beat tachogram — the same artifact-filtered R-R values that
  // feed liveRrRef/coherence below, just also kept as a timestamped rolling
  // buffer for Skrin 1's HrvGraph. Never fake sine+noise: only ever appended
  // to from real accepted BLE readings.
  const [beats, setBeats] = useState<Beat[]>([])
  // Skrin-1-only A/B comparison value — calm-breath-pulse's own
  // frequency-domain coherenceFromBeats(), applied to the exact same
  // artifact-filtered `beats` buffer as everything else here (the artifact
  // filter itself is untouched for this comparison, per your ask — only the
  // formula differs from `coherenceLive`). Not read by Skrin 2/3/4 or
  // sessionStats.ts; computeCoherence (hrvCoherence.ts) stays authoritative
  // there.
  const [coherenceLiveAlt, setCoherenceLiveAlt] = useState<number | null>(null)

  const smootherRef = useRef<BpmSmoother | null>(null)
  const artifactFilterRef = useRef<IbiArtifactFilter | null>(null)
  const liveRrRef = useRef<number[]>([])
  // Mirrors `beats` synchronously (state updates are async) so the alt
  // formula can be computed against the up-to-date buffer in the same tick
  // it's appended to, without a separate effect/render round-trip.
  const beatsRef = useRef<Beat[]>([])
  // Mirrors `coherenceLiveAlt` synchronously for the same reason — read
  // inside handleReading (a stable useCallback with `[]` deps), where the
  // state variable itself would always be stale.
  const coherenceAltRef = useRef<number | null>(null)
  const smoothedBpmRef = useRef<number | null>(null)
  const sessionStartRef = useRef<number>(0)
  // TEMP — jerky-heartbeat-on-contact investigation. Dev-only, same pattern
  // as the raw-bytes log in useHeartRateMonitor.ts. Logs what actually feeds
  // PulseDot's updatePlaybackRate() so we can see real packet cadence/noise
  // instead of guessing at a smoothing constant. Remove once the right
  // amount of animation-specific smoothing (if any) is decided.
  const lastPacketAtRef = useRef<number | null>(null)
  // Ref mirror of sessionActive so handleReading (whose identity must stay
  // stable, it's passed into useHeartRateMonitor) always sees the current
  // value instead of a stale closure.
  const sessionActiveRef = useRef(false)
  // TEMP — same open investigation as ibiArtifactFilter.ts's own TEMP DEBUG
  // logging (rejections vastly outnumbering accepted beats on real
  // hardware). This tallies the same accept/reject split *and* logs the
  // coherence value it actually produces, so a real session's console shows
  // whether coherenceLive genuinely dips below 0.34 (red) or gets starved
  // before it ever gets the chance to.
  const acceptedCountRef = useRef(0)
  const rejectedCountRef = useRef(0)

  const handleReading = useCallback((reading: HeartRateReading) => {
    // Firmware now sends an immediate 2-byte packet (flags=0x04, HR=0) the
    // instant a finger lifts off the sensor, instead of going silent — react
    // to that explicitly rather than letting bpm=0 fall through and get
    // silently dropped by the physio bounds check below (which is what used
    // to make the live display freeze at its last value with no time limit).
    // 'not_supported' devices (feature bit off) are NOT gated here — only an
    // explicit, confirmed "no contact" reading is.
    setSensorContact(reading.sensorContact)
    if (reading.sensorContact === 'not_detected') {
      setContactLost(true)
      setSmoothedBpm(null)
      setCoherenceLive(null)
      smoothedBpmRef.current = null
      // Clear the live rolling window and smoother state so the first real
      // beats after contact resumes don't get averaged/smoothed together
      // with stale pre-loss values spanning the gap.
      liveRrRef.current = []
      smootherRef.current = new BpmSmoother()
      // The next IBI after contact resumes must not be compared against the
      // last IBI from before the gap — that "interval" spans however long
      // the finger was off, not a real beat-to-beat timing.
      artifactFilterRef.current?.reset()
      return
    }
    setContactLost(false)

    if (!smootherRef.current) smootherRef.current = new BpmSmoother()
    // Hard physiological sanity bound — outside this a raw BLE reading is a
    // sensor artifact (motion, poor contact), never a real beat.
    if (reading.bpm < 30 || reading.bpm > 220) return
    const prevSmoothed = smoothedBpmRef.current
    const smoothed = Math.round(smootherRef.current.add(reading.bpm))
    smoothedBpmRef.current = smoothed
    setSmoothedBpm(smoothed)

    if (import.meta.env.DEV) {
      const now = performance.now()
      const dtMs = lastPacketAtRef.current !== null ? Math.round(now - lastPacketAtRef.current) : null
      lastPacketAtRef.current = now
      console.log('[bpm-feed]', {
        raw: reading.bpm,
        smoothed,
        dtMs,
        stepDelta: prevSmoothed !== null ? smoothed - prevSmoothed : null, // change in smoothed bpm since the previous packet
        playbackRate: +(smoothed / 60).toFixed(3),
      })
    }

    if (!sessionActiveRef.current) return

    if (reading.rrIntervalsMs.length) {
      if (!artifactFilterRef.current) artifactFilterRef.current = new IbiArtifactFilter()
      const now = Date.now()
      const acceptedRrs: number[] = []
      for (const rr of reading.rrIntervalsMs) {
        // Reject beat-detection jitter before it ever reaches RMSSD/coherence
        // math — see ibiArtifactFilter.ts. Rejected samples are skipped
        // entirely (not pushed, not counted), but still advance nothing —
        // the filter's own "last accepted" baseline is what the *next*
        // incoming IBI compares against, not this rejected one.
        const accepted = artifactFilterRef.current.accept(rr)
        if (accepted === null) {
          rejectedCountRef.current++
          continue
        }
        acceptedCountRef.current++
        acceptedRrs.push(accepted)
        liveRrRef.current.push(accepted)
        if (liveRrRef.current.length > LIVE_WINDOW_SIZE) liveRrRef.current.shift()
      }
      // Distribute this packet's accepted intervals backward from "now" into
      // timestamped beats, same reconstruction calm-breath-pulse's own
      // device hook uses — except these are the already artifact-filtered
      // values, so Skrin 1's tachogram is cleaner than the source repo's
      // raw/unfiltered version, not fake.
      if (acceptedRrs.length) {
        let cursor = now - acceptedRrs.reduce((s, v) => s + v, 0)
        const next = beatsRef.current.slice()
        for (const rr of acceptedRrs) {
          cursor += rr
          next.push({ t: cursor, rr })
        }
        const capped = next.slice(-BEATS_BUFFER_SIZE)
        beatsRef.current = capped
        setBeats(capped)
        // Skrin-1-only A/B comparison — same artifact-filtered beats as
        // everything else, calm-breath-pulse's own formula instead of
        // computeCoherence's. See src/lib/coherence.ts.
        const alt = coherenceFromBeats(capped, now)
        coherenceAltRef.current = alt
        setCoherenceLiveAlt(alt)
      }
      if (liveRrRef.current.length >= 3) {
        const coherence = computeCoherence(liveRrRef.current)
        setCoherenceLive(coherence)
        if (import.meta.env.DEV) {
          const alt = coherenceAltRef.current
          console.log('[coherence-feed]', {
            coherence: +coherence.toFixed(3),
            zone: getCoherenceZone(coherence),
            // Side-by-side with the Skrin-1-only alt formula, same beats —
            // null until coherenceFromBeats has its own ~20-30s of data.
            coherenceAlt: alt !== null ? +alt.toFixed(3) : null,
            zoneAlt: alt !== null ? getCoherenceZone(alt) : null,
            liveWindowRrMs: [...liveRrRef.current],
            acceptedTotal: acceptedCountRef.current,
            rejectedTotal: rejectedCountRef.current,
          })
        }
      }
    }
  }, [])

  const hr = useHeartRateMonitor({ onReading: handleReading })

  useEffect(() => {
    sessionActiveRef.current = sessionActive
  }, [sessionActive])

  const startSession = useCallback(() => {
    smootherRef.current = new BpmSmoother()
    artifactFilterRef.current = new IbiArtifactFilter()
    liveRrRef.current = []
    smoothedBpmRef.current = null
    sessionStartRef.current = performance.now()
    setSmoothedBpm(null)
    setCoherenceLive(null)
    setHistory([])
    setElapsedSec(0)
    setContactLost(false)
    beatsRef.current = []
    setBeats([])
    coherenceAltRef.current = null
    setCoherenceLiveAlt(null)
    acceptedCountRef.current = 0
    rejectedCountRef.current = 0
    setSessionActive(true)
  }, [])

  // Stops sampling — everything session-scoped (history, elapsedSec) simply
  // freezes at its last value, which is what turns Skrin 4 from a live
  // dashboard into a static end-of-session summary without needing a
  // separate snapshot object. smoothedBpm keeps updating from the ongoing
  // BLE feed (the pulse readout stays alive on the connect screen too).
  const endSession = useCallback(() => {
    setSessionActive(false)
  }, [])

  // Periodic sampler for the session timeline — one HistoryPoint every
  // HISTORY_SAMPLE_MS, only while the session is running and only once real
  // coherence exists (i.e. only for sessions using a device). rmssdMs is
  // computed off the same rolling R-R window coherenceLive was just derived
  // from, so the ring, the live score, and this sample never disagree about
  // "right now."
  useEffect(() => {
    if (!sessionActive) return
    const id = window.setInterval(() => {
      if (liveRrRef.current.length < 3) return
      const t = Math.round((performance.now() - sessionStartRef.current) / 1000)
      const coherence = computeCoherence(liveRrRef.current)
      const rmssdMs = computeRmssdMs(liveRrRef.current)
      setHistory(prev => [...prev, { t, coherence, bpm: smoothedBpmRef.current, rmssdMs }])
    }, HISTORY_SAMPLE_MS)
    return () => window.clearInterval(id)
  }, [sessionActive])

  // Separate 1s clock for the "Length" stat — ticks regardless of whether a
  // device is connected (a no-device session still has a duration), unlike
  // `history` which only grows when real HRV data is flowing.
  useEffect(() => {
    if (!sessionActive) return
    const id = window.setInterval(() => {
      setElapsedSec(Math.round((performance.now() - sessionStartRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [sessionActive])

  // Real HeartRateDevice-shaped view of `hr`, for Skrin 1's DeviceConnect
  // (ported from calm-breath-pulse) — same live connection as everywhere
  // else in the app, just reshaped to the prop contract that copied
  // component expects. No second BLE connection is created.
  const deviceStatus: DeviceStatus =
    hr.state === 'disconnected' ? (hr.error ? 'error' : 'idle') : hr.state
  const device: HeartRateDevice = {
    status: deviceStatus,
    deviceName: hr.deviceName,
    error: hr.error,
    bpm: hr.bpm ?? 0,
    beats,
    hasRr: beats.length > 0,
    connect: hr.connect,
    disconnect: hr.disconnect,
  }

  return {
    ...hr,
    smoothedBpm,
    coherenceLive,
    coherenceLiveAlt,
    contactLost,
    sensorContact,
    sessionActive,
    history,
    elapsedSec,
    beats,
    device,
    // No fake data mode exists in Bernafas (unlike calm-breath-pulse's
    // sine+noise fallback) — "simulated" here just means "no live device,"
    // i.e. Skrin 1 should say so honestly rather than show a faked reading.
    simulated: hr.state !== 'connected',
    startSession,
    endSession,
  }
}
