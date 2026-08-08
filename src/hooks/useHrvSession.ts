import { useCallback, useEffect, useRef, useState } from 'react'
import { useHeartRateMonitor, type HeartRateReading } from '@/hooks/useHeartRateMonitor'
import { computeCoherence, computeRmssdMs } from '@/lib/hrvCoherence'
import { BpmSmoother } from '@/lib/bpmSmoother'
import { IbiArtifactFilter } from '@/lib/ibiArtifactFilter'
import type { HistoryPoint } from '@/lib/sessionStats'

export type { HistoryPoint }

// TEMP DEBUG (Issue 2 investigation, remove once diagnosed) — live counters
// for the three things that could be starving `history` on real hardware:
// how often contact actually drops, how often a beat gets rejected as an
// IBI artifact, and how often the sampler below no-ops because the live R-R
// window hasn't reached 3 accepted beats yet. Surfaced via DebugOverlay.
export interface HrvDebugStats {
  contactLostFlips: number
  rejectedBeats: number
  sparseGateSkips: number
}
const EMPTY_DEBUG_STATS: HrvDebugStats = { contactLostFlips: 0, rejectedBeats: 0, sparseGateSkips: 0 }

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
  // TEMP DEBUG — see HrvDebugStats above.
  const [debugStats, setDebugStats] = useState<HrvDebugStats>(EMPTY_DEBUG_STATS)

  const smootherRef = useRef<BpmSmoother | null>(null)
  const artifactFilterRef = useRef<IbiArtifactFilter | null>(null)
  const liveRrRef = useRef<number[]>([])
  const smoothedBpmRef = useRef<number | null>(null)
  const sessionStartRef = useRef<number>(0)
  // Ref mirror of sessionActive so handleReading (whose identity must stay
  // stable, it's passed into useHeartRateMonitor) always sees the current
  // value instead of a stale closure.
  const sessionActiveRef = useRef(false)
  // TEMP DEBUG counters — kept in refs (not state) so every single BLE
  // reading/rejected-beat doesn't trigger a re-render; mirrored into
  // debugStats state once a second alongside elapsedSec instead.
  const contactLostRef = useRef(false) // for edge-detecting a *flip* into lost, not every not_detected packet
  const contactLostFlipCountRef = useRef(0)
  const rejectedBeatCountRef = useRef(0)
  const sparseGateSkipCountRef = useRef(0)

  const handleReading = useCallback((reading: HeartRateReading) => {
    // Firmware now sends an immediate 2-byte packet (flags=0x04, HR=0) the
    // instant a finger lifts off the sensor, instead of going silent — react
    // to that explicitly rather than letting bpm=0 fall through and get
    // silently dropped by the physio bounds check below (which is what used
    // to make the live display freeze at its last value with no time limit).
    // 'not_supported' devices (feature bit off) are NOT gated here — only an
    // explicit, confirmed "no contact" reading is.
    if (reading.sensorContact === 'not_detected') {
      // TEMP DEBUG — count the flip into "lost", not every not_detected
      // packet (a real dropout can send many in a row).
      if (!contactLostRef.current) {
        contactLostRef.current = true
        contactLostFlipCountRef.current++
      }
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
    contactLostRef.current = false // TEMP DEBUG — contact regained
    setContactLost(false)

    if (!smootherRef.current) smootherRef.current = new BpmSmoother()
    // Hard physiological sanity bound — outside this a raw BLE reading is a
    // sensor artifact (motion, poor contact), never a real beat.
    if (reading.bpm < 30 || reading.bpm > 220) return
    const smoothed = Math.round(smootherRef.current.add(reading.bpm))
    smoothedBpmRef.current = smoothed
    setSmoothedBpm(smoothed)

    if (!sessionActiveRef.current) return

    if (reading.rrIntervalsMs.length) {
      if (!artifactFilterRef.current) artifactFilterRef.current = new IbiArtifactFilter()
      for (const rr of reading.rrIntervalsMs) {
        // Reject beat-detection jitter before it ever reaches RMSSD/coherence
        // math — see ibiArtifactFilter.ts. Rejected samples are skipped
        // entirely (not pushed, not counted), but still advance nothing —
        // the filter's own "last accepted" baseline is what the *next*
        // incoming IBI compares against, not this rejected one.
        const accepted = artifactFilterRef.current.accept(rr)
        if (accepted === null) {
          rejectedBeatCountRef.current++ // TEMP DEBUG
          continue
        }
        liveRrRef.current.push(accepted)
        if (liveRrRef.current.length > LIVE_WINDOW_SIZE) liveRrRef.current.shift()
      }
      if (liveRrRef.current.length >= 3) {
        setCoherenceLive(computeCoherence(liveRrRef.current))
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
    // TEMP DEBUG — fresh counters per session.
    contactLostRef.current = false
    contactLostFlipCountRef.current = 0
    rejectedBeatCountRef.current = 0
    sparseGateSkipCountRef.current = 0
    setDebugStats(EMPTY_DEBUG_STATS)
    setSessionActive(true)
  }, [])

  // Stops sampling — everything session-scoped (history, elapsedSec) simply
  // freezes at its last value, which is what turns Skrin 4 from a live
  // dashboard into a static end-of-session summary without needing a
  // separate snapshot object. smoothedBpm keeps updating from the ongoing
  // BLE feed (the pulse readout stays alive on the connect screen too).
  const endSession = useCallback(() => {
    setSessionActive(false)
    // TEMP DEBUG — final numbers for the Issue 2 investigation, logged once
    // per session rather than continuously to avoid spamming the console.
    console.log('[useHrvSession] TEMP DEBUG session summary:', {
      contactLostFlips: contactLostFlipCountRef.current,
      rejectedBeats: rejectedBeatCountRef.current,
      sparseGateSkips: sparseGateSkipCountRef.current,
    })
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
      if (liveRrRef.current.length < 3) {
        sparseGateSkipCountRef.current++ // TEMP DEBUG
        return
      }
      const t = Math.round((performance.now() - sessionStartRef.current) / 1000)
      const coherence = computeCoherence(liveRrRef.current)
      const rmssdMs = computeRmssdMs(liveRrRef.current)
      setHistory(prev => [...prev, { t, coherence, bpm: smoothedBpmRef.current, rmssdMs }])
    }, HISTORY_SAMPLE_MS)
    return () => window.clearInterval(id)
  }, [sessionActive])

  // Separate 1s clock for the "Length" stat — ticks regardless of whether a
  // device is connected (a no-device session still has a duration), unlike
  // `history` which only grows when real HRV data is flowing. Also mirrors
  // the TEMP DEBUG ref counters into state here, piggybacking on this
  // existing tick rather than adding a fourth interval just for that.
  useEffect(() => {
    if (!sessionActive) return
    const id = window.setInterval(() => {
      setElapsedSec(Math.round((performance.now() - sessionStartRef.current) / 1000))
      setDebugStats({
        contactLostFlips: contactLostFlipCountRef.current,
        rejectedBeats: rejectedBeatCountRef.current,
        sparseGateSkips: sparseGateSkipCountRef.current,
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [sessionActive])

  return {
    ...hr,
    smoothedBpm,
    coherenceLive,
    contactLost,
    sessionActive,
    history,
    elapsedSec,
    debugStats, // TEMP DEBUG — see HrvDebugStats
    startSession,
    endSession,
  }
}
