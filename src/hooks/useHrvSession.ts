import { useCallback, useEffect, useRef, useState } from 'react'
import { useHeartRateMonitor, type HeartRateReading } from '@/hooks/useHeartRateMonitor'
import { computeCoherence } from '@/lib/hrvCoherence'
import { BpmSmoother } from '@/lib/bpmSmoother'
import { IbiArtifactFilter } from '@/lib/ibiArtifactFilter'

// How many real R-R intervals feed the *live* on-screen coherence ring.
// Short/responsive on purpose (so the number moves with the breath the user
// just took) — same caveat as Audit Jiwa's live HUD: a ~short rolling window
// is far shorter than the 60s window HRV research validates computeCoherence
// against. Fine for a live "how am I doing right now" glance, not a
// scientific reading — that's what the session-end average is for.
const LIVE_WINDOW_SIZE = 8

// How often a coherence sample is pushed into history, for the post-session
// trend sparkline.
const HISTORY_SAMPLE_MS = 3000

export interface CoherencePoint {
  t: number // seconds since session start
  value: number // 0-1
}

export interface SessionSummary {
  durationSec: number
  usedDevice: boolean
  avgCoherence: number | null // 0-1, null if no real R-R data this session
  startBpm: number | null
  endBpm: number | null
  avgBpm: number | null
  coherenceHistory: CoherencePoint[]
}

export function useHrvSession() {
  const [sessionActive, setSessionActive] = useState(false)
  const [smoothedBpm, setSmoothedBpm] = useState<number | null>(null)
  const [coherenceLive, setCoherenceLive] = useState<number | null>(null)
  const [coherenceHistory, setCoherenceHistory] = useState<CoherencePoint[]>([])
  // True the instant a "Sensor Contact Detected" = 0 packet arrives (finger
  // lifted off the sensor) — distinct from hr.state disconnecting (BLE link
  // itself dropping). The device stays connected the whole time; this is a
  // milder, much more common condition (repositioning a finger mid-session).
  const [contactLost, setContactLost] = useState(false)

  const smootherRef = useRef<BpmSmoother | null>(null)
  const artifactFilterRef = useRef<IbiArtifactFilter | null>(null)
  const liveRrRef = useRef<number[]>([])
  const sessionRrRef = useRef<number[]>([])
  const bpmSamplesRef = useRef<number[]>([])
  const startBpmRef = useRef<number | null>(null)
  const endBpmRef = useRef<number | null>(null)
  const usedDeviceRef = useRef(false)
  const sessionStartRef = useRef<number>(0)
  // Ref mirror of sessionActive so handleReading (whose identity must stay
  // stable, it's passed into useHeartRateMonitor) always sees the current
  // value instead of a stale closure.
  const sessionActiveRef = useRef(false)

  const handleReading = useCallback((reading: HeartRateReading) => {
    // Firmware now sends an immediate 2-byte packet (flags=0x04, HR=0) the
    // instant a finger lifts off the sensor, instead of going silent — react
    // to that explicitly rather than letting bpm=0 fall through and get
    // silently dropped by the physio bounds check below (which is what used
    // to make the live display freeze at its last value with no time limit).
    // 'not_supported' devices (feature bit off) are NOT gated here — only an
    // explicit, confirmed "no contact" reading is.
    if (reading.sensorContact === 'not_detected') {
      setContactLost(true)
      setSmoothedBpm(null)
      setCoherenceLive(null)
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
    const smoothed = smootherRef.current.add(reading.bpm)
    setSmoothedBpm(Math.round(smoothed))

    if (!sessionActiveRef.current) return
    usedDeviceRef.current = true
    bpmSamplesRef.current.push(reading.bpm)
    endBpmRef.current = reading.bpm
    if (startBpmRef.current === null) startBpmRef.current = reading.bpm

    if (reading.rrIntervalsMs.length) {
      if (!artifactFilterRef.current) artifactFilterRef.current = new IbiArtifactFilter()
      for (const rr of reading.rrIntervalsMs) {
        // Reject beat-detection jitter before it ever reaches RMSSD/coherence
        // math — see ibiArtifactFilter.ts. Rejected samples are skipped
        // entirely (not pushed, not counted), but still advance nothing —
        // the filter's own "last accepted" baseline is what the *next*
        // incoming IBI compares against, not this rejected one.
        const accepted = artifactFilterRef.current.accept(rr)
        if (accepted === null) continue
        liveRrRef.current.push(accepted)
        if (liveRrRef.current.length > LIVE_WINDOW_SIZE) liveRrRef.current.shift()
        sessionRrRef.current.push(accepted)
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
    sessionRrRef.current = []
    bpmSamplesRef.current = []
    startBpmRef.current = null
    endBpmRef.current = null
    usedDeviceRef.current = false
    sessionStartRef.current = performance.now()
    setSmoothedBpm(null)
    setCoherenceLive(null)
    setCoherenceHistory([])
    setContactLost(false)
    setSessionActive(true)
  }, [])

  const endSession = useCallback((): SessionSummary => {
    setSessionActive(false)
    const durationSec = Math.round((performance.now() - sessionStartRef.current) / 1000)
    const avgCoherence = sessionRrRef.current.length >= 3 ? computeCoherence(sessionRrRef.current) : null
    const avgBpm = bpmSamplesRef.current.length
      ? Math.round(bpmSamplesRef.current.reduce((a, b) => a + b, 0) / bpmSamplesRef.current.length)
      : null
    return {
      durationSec,
      usedDevice: usedDeviceRef.current,
      avgCoherence,
      startBpm: startBpmRef.current,
      endBpm: endBpmRef.current,
      avgBpm,
      coherenceHistory,
    }
  }, [coherenceHistory])

  // Periodic history sampler for the post-session trend sparkline — only
  // while a session is running, and only once real coherence exists.
  useEffect(() => {
    if (!sessionActive) return
    const id = window.setInterval(() => {
      setCoherenceHistory(prev => {
        if (coherenceLive === null) return prev
        const t = Math.round((performance.now() - sessionStartRef.current) / 1000)
        return [...prev, { t, value: coherenceLive }]
      })
    }, HISTORY_SAMPLE_MS)
    return () => window.clearInterval(id)
  }, [sessionActive, coherenceLive])

  return {
    ...hr,
    smoothedBpm,
    coherenceLive,
    contactLost,
    sessionActive,
    startSession,
    endSession,
  }
}
