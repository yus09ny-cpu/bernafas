// Ported verbatim from calm-breath-pulse's src/components/session/HrvGraph.tsx
// for Skrin 1. `beats` here is the real, artifact-filtered R-R tachogram
// built in useHrvSession.ts from live BLE readings — never generated.
import { useEffect, useRef, useState } from 'react'
import type { Beat } from '@/lib/coherence'
import { buildScrollingSegments } from '@/lib/scrollingLineChart'

const WINDOW_SEC = 60
const VB_W = 1000
const VB_H = 120

/**
 * Real HRV tachogram: instantaneous heart rate (60000 / RR) plotted per beat
 * across a rolling 60-second window, scrolling right-to-left in real time.
 *
 * `color` is NOT part of the original calm-breath-pulse component — it
 * defaults to unset, which keeps the original `text-primary`/light-edge-fade
 * styling exactly as-is (Skrin 1/2, both on the app's fixed pastel
 * background). Skrin 3 passes an explicit color (white) because it sits
 * over an arbitrary user photo instead, where the default light-background
 * fade and brand-teal line would be the wrong treatment entirely.
 */
export function HrvGraph({ beats, color }: { beats: Beat[]; color?: string }) {
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

    // Real beats here are already artifact-filtered (see useHrvSession.ts) —
    // but real hardware still drops enough of them that consecutive accepted
    // points can be several real seconds apart; buildScrollingSegments
    // breaks the line at those dropouts instead of interpolating a fake
    // spike across them (see scrollingLineChart.ts).
    const result = buildScrollingSegments(
      pts.map(p => ({ t: p.t, v: p.hr })),
      { from, windowMs: WINDOW_SEC * 1000, width: VB_W, height: VB_H, minValue: lo, maxValue: hi, maxGapMs: 2500 },
    )
    path = result.path
    area = result.area
  }

  // Default (no color prop): original text-primary + light-background fade,
  // pixel-identical to before this prop existed. Custom color (Skrin 3):
  // inline `color` style overrides text-primary via currentColor, and the
  // edge fades/labels switch to a dark scrim + white text, matching the
  // same white-with-shadow treatment the rest of Skrin 3 already uses over
  // its photo background.
  const customColor = color !== undefined
  const labelClass = customColor ? 'text-white' : 'text-muted-foreground'
  const labelStyle = customColor ? { textShadow: '0 1px 4px rgba(0,0,0,0.4)' } : undefined

  return (
    // min-h-[64px] alongside h-28: `overflow-hidden` on a flex item
    // otherwise overrides its automatic min-size to 0 (CSS flexbox spec),
    // making this the item a too-short mobile viewport squeezes first — all
    // the way to a fully collapsed 0px on Page1Ring specifically (its extra
    // header row above this graph tips it over the edge before Skrin 2/3).
    // An explicit min-height isn't subject to that auto-min-size override,
    // so it puts a floor under the shrink instead of letting it hit zero —
    // see the Playwright viewport-height sweep in the commit message for
    // the before/after numbers.
    <div className="relative h-28 min-h-[64px] w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className={customColor ? 'h-full w-full' : 'h-full w-full text-primary'}
        style={customColor ? { color } : undefined}
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

      {customColor ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black/35 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-black/35 to-transparent" />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" />
        </>
      )}
      <div className={`pointer-events-none absolute left-0 top-0 z-20 text-[10px] uppercase tracking-widest ${labelClass}`} style={labelStyle}>
        HRV · {WINDOW_SEC}s
      </div>
      {pts.length > 1 && (
        <div className={`pointer-events-none absolute right-1 top-0 z-20 text-[10px] tabular-nums ${labelClass}`} style={labelStyle}>
          {Math.round(hi)}–{Math.round(lo)} bpm
        </div>
      )}
    </div>
  )
}
