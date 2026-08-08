import { useEffect, useRef, useState } from 'react'
import { COACHING_PROMPTS_BM } from '@/data/coachingPrompts'

const ROTATE_MS = 25000
const FADE_MS = 400

interface CoachingPromptsProps {
  running: boolean
}

// Rotates through COACHING_PROMPTS_BM every ~25s with a soft cross-fade.
// Order is fixed (not shuffled) — a stable sequence reads as deliberate
// pacing rather than random flicker, and repeats identically session to
// session, which is fine for a handful of short generic lines like these.
export default function CoachingPrompts({ running }: CoachingPromptsProps) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const indexRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setVisible(false)
      window.setTimeout(() => {
        indexRef.current = (indexRef.current + 1) % COACHING_PROMPTS_BM.length
        setIndex(indexRef.current)
        setVisible(true)
      }, FADE_MS)
    }, ROTATE_MS)
    return () => window.clearInterval(id)
  }, [running])

  return (
    <p
      className="max-w-xs text-center text-sm font-medium text-[var(--color-primary-dark)] transition-opacity"
      style={{ opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
    >
      {COACHING_PROMPTS_BM[index]}
    </p>
  )
}
