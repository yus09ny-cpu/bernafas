// Reused verbatim from Audit Jiwa (src/hooks/useWakeLock.ts).

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Minimal ambient Screen Wake Lock types ────────────────────────────────

interface WakeLockSentinel extends EventTarget {
  readonly released: boolean
  release(): Promise<void>
}

interface NavigatorWakeLock {
  request(type: 'screen'): Promise<WakeLockSentinel>
}

export type WakeLockStatus = 'unsupported' | 'active' | 'released'

function getWakeLock(): NavigatorWakeLock | undefined {
  if (typeof navigator === 'undefined') return undefined
  if (!('wakeLock' in navigator)) return undefined
  return (navigator as Navigator & { wakeLock: NavigatorWakeLock }).wakeLock
}

// ─── Hook ────────────────────────────────────────────────────────────────
// Scoped to whichever component calls it — request() must be called
// explicitly (e.g. on session start), it is never auto-acquired on mount.

export function useWakeLock() {
  const isSupported = getWakeLock() !== undefined
  const [status, setStatus] = useState<WakeLockStatus>(isSupported ? 'released' : 'unsupported')

  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  // Tracks whether the caller currently *wants* the lock held, so the
  // visibilitychange re-acquire only fires for sessions that asked for it —
  // not for every tab that happens to become visible again.
  const wantActiveRef = useRef(false)

  const request = useCallback(async () => {
    const wakeLock = getWakeLock()
    if (!wakeLock) {
      setStatus('unsupported')
      return
    }
    wantActiveRef.current = true
    try {
      const sentinel = await wakeLock.request('screen')
      sentinelRef.current = sentinel
      setStatus('active')
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current === sentinel) setStatus('released')
      })
    } catch (err) {
      console.error('[useWakeLock] request failed:', err)
      setStatus('released')
    }
  }, [])

  const release = useCallback(async () => {
    wantActiveRef.current = false
    const sentinel = sentinelRef.current
    sentinelRef.current = null
    if (!sentinel) return
    try {
      await sentinel.release()
    } catch (err) {
      console.error('[useWakeLock] release failed:', err)
    }
    setStatus(prev => (prev === 'unsupported' ? prev : 'released'))
  }, [])

  // Mobile browsers release the wake lock automatically when the tab is
  // backgrounded — re-acquire it once the tab is visible again, but only if
  // the caller hadn't manually released it in the meantime.
  useEffect(() => {
    if (!isSupported) return
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wantActiveRef.current) {
        request()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [isSupported, request])

  // Release on unmount so we never leak a held wake lock past the session view.
  useEffect(() => {
    return () => {
      const sentinel = sentinelRef.current
      sentinelRef.current = null
      if (sentinel) {
        sentinel.release().catch(err => console.error('[useWakeLock] release on unmount failed:', err))
      }
    }
  }, [])

  return { status, request, release }
}
