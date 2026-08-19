import { useEffect, useState } from 'react'
import { Loader2, PartyPopper, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getEnrollment, createEnrollment } from '@/lib/program40/enrollment'
import { getPhaseForDay, suggestTechniqueForNow, PHASE_META, TECHNIQUE_META, PROGRAM_40_DAY_TOTAL } from '@/lib/program40/curriculum'
import Program40SessionScreen from '@/screens/program40/Program40SessionScreen'
import Program40Dashboard from '@/screens/program40/Program40Dashboard'
import JadualHarianCard from '@/components/program40/JadualHarianCard'
import type { Program40Enrollment } from '@/lib/program40/types'

type View = 'loading' | 'landing' | 'home' | 'session' | 'dashboard'

// Panduan tab's entry point into the 40-day module (per user's nav-placement
// choice — see the memory this session left). Owns the one enrollment fetch
// this whole module needs; Program40SessionScreen/Program40Dashboard both
// receive it as a prop rather than re-fetching it themselves.
export default function Program40Hub() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [view, setView] = useState<View>('loading')
  const [enrollment, setEnrollment] = useState<Program40Enrollment | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    getEnrollment(userId).then(({ data }) => {
      if (cancelled) return
      setEnrollment(data)
      setView(data ? 'home' : 'landing')
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const refreshAfterSession = () => {
    if (!userId) return
    setView('loading')
    getEnrollment(userId).then(({ data }) => {
      setEnrollment(data)
      setView('home')
    })
  }

  const handleStart = async () => {
    if (!userId || starting) return
    setStarting(true)
    const { data } = await createEnrollment(userId)
    setStarting(false)
    if (data) {
      setEnrollment(data)
      setView('home')
    }
  }

  if (!userId || view === 'loading') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--color-primary)]" />
      </div>
    )
  }

  if (view === 'landing') {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center"
        style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom))' }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/70 text-[var(--color-primary)]">
          <Sparkles size={30} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-[var(--color-primary-dark)]">Latihan 40 Hari</span>
          <span className="max-w-xs text-sm text-[var(--color-text-muted)]">
            Satu sesi pernafasan sehari, 40 hari — dengan atau tanpa peranti HRV, ikut kesesuaian anda.
          </span>
        </div>
        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="w-full max-w-xs rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
        >
          {starting ? 'Memulakan...' : 'Mula Program 40 Hari'}
        </button>
      </div>
    )
  }

  if (!enrollment) return null

  if (view === 'session') {
    return <Program40SessionScreen userId={userId} enrollment={enrollment} onExit={refreshAfterSession} />
  }

  if (view === 'dashboard') {
    return <Program40Dashboard userId={userId} enrollment={enrollment} onBack={() => setView('home')} />
  }

  const isCompleted = enrollment.status === 'completed'
  const nextDay = Math.min(PROGRAM_40_DAY_TOTAL, enrollment.currentDay + 1)
  const phase = getPhaseForDay(nextDay)
  // A suggestion only — TechniquePicker (shown once "Mula Sesi Hari Ini" is
  // pressed) is where the user actually confirms/changes which of the
  // day's unlocked techniques this sitting is for.
  const suggestedTechnique = suggestTechniqueForNow(nextDay)

  return (
    <div
      className="flex h-full flex-col items-center gap-6 overflow-y-auto px-8 py-10 text-center"
      style={{ paddingBottom: 'calc(var(--nav-height) + 2rem + var(--safe-bottom))' }}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/70 text-[var(--color-primary)]">
        {isCompleted ? <PartyPopper size={30} /> : <Sparkles size={30} />}
      </div>

      {isCompleted ? (
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-[var(--color-primary-dark)]">Tahniah — 40 hari selesai!</span>
          <span className="max-w-xs text-sm text-[var(--color-text-muted)]">Anda boleh terus berlatih bila-bila masa, atau semak rekod penuh anda.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold text-[var(--color-primary-dark)]">Hari {nextDay} / {PROGRAM_40_DAY_TOTAL}</span>
          <span className="text-sm text-[var(--color-text-muted)]">
            {PHASE_META[phase].label} · Cadangan: {TECHNIQUE_META[suggestedTechnique].label}
          </span>
        </div>
      )}

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => setView('session')}
          className="rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95"
        >
          {isCompleted ? 'Latih Lagi' : 'Mula Sesi Hari Ini'}
        </button>
        <button
          type="button"
          onClick={() => setView('dashboard')}
          className="rounded-full bg-white/70 px-6 py-3 text-sm font-medium text-[var(--color-text-muted)]"
        >
          Lihat Dashboard 40 Hari
        </button>
      </div>

      <JadualHarianCard phase={phase} />
    </div>
  )
}
