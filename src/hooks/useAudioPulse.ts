// Reused from Audit Jiwa (src/hooks/useAudioPulse.ts) — only the localStorage
// key was renamed (bernafas_* instead of madrasah_khafi_*), since this is a
// separate origin/app with its own storage namespace.

import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'bernafas_audio_pulse'

function getAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

// ─── Hook ────────────────────────────────────────────────────────────────
// A soft, wordless "thump" per pulse tick — never speech, never a sharp
// click. Volume/enabled is off by default and persisted locally.
//
// init() MUST be called synchronously inside the same user-gesture handler
// that starts a session (e.g. the "Mula" button's onClick, with no `await`
// before it) — browsers refuse to run an AudioContext created outside a
// gesture, and there is no reliable way to recover from that after the fact.

export function useAudioPulse() {
  const isSupported = getAudioContextCtor() !== undefined
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  })
  const ctxRef = useRef<AudioContext | null>(null)

  const init = useCallback(() => {
    if (!isSupported || ctxRef.current) return
    try {
      const Ctor = getAudioContextCtor()!
      ctxRef.current = new Ctor()
    } catch (err) {
      console.error('[useAudioPulse] init failed:', err)
    }
  }, [isSupported])

  const play = useCallback(() => {
    if (!enabled) return
    const ctx = ctxRef.current
    if (!ctx) return
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(err => console.error('[useAudioPulse] resume failed:', err))
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 110 // soft low thump, not a click
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015) // gentle attack
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35) // short decay
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.4)
    } catch (err) {
      console.error('[useAudioPulse] play failed:', err)
    }
  }, [enabled])

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch (err) {
      console.error('[useAudioPulse] failed to persist preference:', err)
    }
  }, [])

  useEffect(() => {
    return () => {
      const ctx = ctxRef.current
      ctxRef.current = null
      if (ctx) ctx.close().catch(err => console.error('[useAudioPulse] close on unmount failed:', err))
    }
  }, [])

  return { isSupported, enabled, setEnabled, init, play }
}
