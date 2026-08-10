// Ported verbatim from calm-breath-pulse's src/components/session/HrvGraph.tsx
// for Skrin 1. `beats` here is the real, artifact-filtered R-R tachogram
// built in useHrvSession.ts from live BLE readings — never generated.
import { useEffect, useRef, useState } from 'react'
import type { Beat } from '@/lib/coherence'

const WINDOW_SEC = 60
const VB_W = 1000
const VB_H = 120

/**
 * Real HRV tachogram: instantaneous heart rate (60000 / RR) plotted per beat
 * across a rolling 60-second window, scrolling right-to-left in real time.
 */
export function HrvGraph({ beats }: { beats: Beat[] }) {
  const [now, setNow] = useState(() => Date.now())
  const rafRef = useRef<number>(0)

  // Smooth scrolling: advance the right edge every frame, independent of the
  // 1 Hz sample cadence, so the trace glides rather than steps.
  useEffect(() => {
    const loop = () => {
      setNow(Date.now())
      rafRef.current = window.requestAnimationFrame(loop)
    }
    rafRef.current = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(rafRef.current)
  }, [])

  const from = now - WINDOW_SEC * 1000
  const pts = beats
    .filter(b => b.t >= from - 2000 && b.rr > 300 && b.rr < 2000)
    .map(b => ({ t: b.t, hr: 60000 / b.rr }))

  let path = ''
  let area = ''
  let lo = 0
  let hi = 0
  if (pts.length > 1) {
    const hrs = pts.map(p => p.hr)
    const min = Math.min(...hrs)
    const max = Math.max(...hrs)
    const pad = Math.max(3, (max - min) * 0.25)
    lo = min - pad
    hi = max + pad
    const x = (t: number) => ((t - from) / (WINDOW_SEC * 1000)) * VB_W
    const y = (hr: number) => VB_H - ((hr - lo) / (hi - lo || 1)) * VB_H

    // Real beats here are already artifact-filtered (see useHrvSession.ts) —
    // but real hardware still drops enough of them that consecutive accepted
    // points can be several real seconds apart. Smoothly interpolating across
    // a gap like that draws a fake "spike" between two beats that were never
    // actually adjacent. Instead, break into a new subpath whenever the real
    // gap is bigger than a plausible single dropped beat, so a dropout reads
    // as a break in the line (like a real ECG strip), not a jagged curve.
    const MAX_GAP_MS = 2500
    const coordSegments: { x: number; y: number }[][] = []
    let current: { x: number; y: number }[] = []
    for (let i = 0; i < pts.length; i++) {
      if (i > 0 && pts[i]!.t - pts[i - 1]!.t > MAX_GAP_MS) {
        if (current.length > 1) coordSegments.push(current)
        current = []
      }
      current.push({ x: x(pts[i]!.t), y: y(pts[i]!.hr) })
    }
    if (current.length > 1) coordSegments.push(current)

    // Catmull-Rom-ish smoothing keeps beat detail without jagged corners.
    const buildPath = (coords: { x: number; y: number }[]) => {
      let d = `M ${coords[0]!.x.toFixed(1)} ${coords[0]!.y.toFixed(1)}`
      for (let i = 1; i < coords.length; i++) {
        const p = coords[i - 1]!
        const c = coords[i]!
        const mx = (p.x + c.x) / 2
        d += ` C ${mx.toFixed(1)} ${p.y.toFixed(1)}, ${mx.toFixed(1)} ${c.y.toFixed(1)}, ${c.x.toFixed(1)} ${c.y.toFixed(1)}`
      }
      return d
    }

    path = coordSegments.map(buildPath).join(' ')
    area = coordSegments
      .map(coords => {
        const d = buildPath(coords)
        const last = coords[coords.length - 1]!
        return `${d} L ${last.x.toFixed(1)} ${VB_H} L ${coords[0]!.x.toFixed(1)} ${VB_H} Z`
      })
      .join(' ')
  }

  return (
    <div className="relative h-28 w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="h-full w-full text-primary"
        role="img"
        aria-label="Graf HRV langsung: kadar denyutan sesaat"
      >
        <defs>
          <linearGradient id="hrv-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(g => (
          <line key={g} x1={0} x2={VB_W} y1={VB_H * g} y2={VB_H * g} stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
        ))}
        {area && <path d={area} fill="url(#hrv-fill)" />}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" />
      <div className="pointer-events-none absolute left-0 top-0 z-20 text-[10px] uppercase tracking-widest text-muted-foreground">
        HRV · {WINDOW_SEC}s
      </div>
      {pts.length > 1 && (
        <div className="pointer-events-none absolute right-1 top-0 z-20 text-[10px] tabular-nums text-muted-foreground">
          {Math.round(hi)}–{Math.round(lo)} bpm
        </div>
      )}
    </div>
  )
}
