// Breathing cue timeline for the WHM video (Vimeo id 1043048429) — drives
// Skrin 2's label text and PulsingSphere expand/contract timing directly off
// the video's own playback position (see Page2Mandala.tsx), instead of the
// shared 5s/5s useBreathingPacer. Cues must be sorted ascending by `t`.
export type WhmCuePhase = 'tarik' | 'hembus' | 'tahan' | 'pulih'

export interface WhmCue {
  // Seconds from video start.
  t: number
  phase: WhmCuePhase
}

// PLACEHOLDER — rough, made-up timings, NOT matched to the real video.
// Exists only so whmCues.ts has real data to type-check and render against
// before real cues are recorded. Replace with the output of the
// /admin/whm-cues recorder's "Salin" button (same {t, phase}[] shape) before
// this is considered accurate.
export const WHM_CUES: WhmCue[] = [
  { t: 0, phase: 'tarik' },
  { t: 3, phase: 'hembus' },
  { t: 6, phase: 'tarik' },
  { t: 9, phase: 'hembus' },
  { t: 12, phase: 'tahan' },
  { t: 42, phase: 'pulih' },
  { t: 57, phase: 'tahan' },
  { t: 72, phase: 'tarik' },
]
