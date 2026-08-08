import { computeSessionStats } from '@/lib/sessionStats'
import StatBar from '@/components/session/StatBar'
import HrvLineChart from '@/components/session/HrvLineChart'
import CoherenceBandChart from '@/components/session/CoherenceBandChart'
import RmssdTrendChart from '@/components/session/RmssdTrendChart'
import PulseReadout from '@/components/session/PulseReadout'
import UnlockBonusCard from '@/components/UnlockBonusCard'
import type { LiveSessionData } from './types'

// Skrin 4 — the only carousel page that scrolls vertically instead of
// swiping further. Everything here is derived from `data.history`/
// `data.elapsedSec`, the same live stream Skrin 1-3 render — while the
// session is still active this doubles as a live dashboard; once
// onEnd() stops the session, sampling stops and these numbers simply hold
// at their last value, turning it into the end-of-session summary for free.
export default function Page4Summary({ data }: { data: LiveSessionData }) {
  const stats = computeSessionStats(data.history)
  const usedDevice = data.history.length > 0

  return (
    <div
      className="flex h-full w-full flex-col items-center gap-4 overflow-y-auto px-5"
      style={{
        paddingTop: 'calc(4.5rem + var(--safe-top))',
        paddingBottom: 'calc(var(--nav-height) + 2rem + var(--safe-bottom))',
      }}
    >
      <StatBar stats={stats} elapsedSec={data.elapsedSec} cycleCount={data.cycleCount} />

      {usedDevice ? (
        <>
          <HrvLineChart history={data.history} />
          <CoherenceBandChart history={data.history} />
          <RmssdTrendChart history={data.history} />
        </>
      ) : (
        <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-white/60 px-6 py-8 text-center">
          <span className="text-sm text-[var(--color-text)]">Sesi tanpa peranti HRV</span>
          <span className="max-w-xs text-xs text-[var(--color-text-muted)]">
            Sambungkan peranti HRV pada sesi akan datang untuk lihat carta HRV anda.
          </span>
        </div>
      )}

      <PulseReadout currentBpm={data.bpm} stats={stats} />

      {data.showUnlockBonus && <UnlockBonusCard />}
    </div>
  )
}
