import { Bluetooth, BluetoothConnected, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HeartRateMonitorState } from '@/hooks/useHeartRateMonitor'

interface ConnectScreenProps {
  state: HeartRateMonitorState
  deviceName: string | null
  error: string | null
  bpm: number | null
  onConnect: () => void
  onContinue: () => void
  onSkip: () => void
}

export default function ConnectScreen({
  state,
  deviceName,
  error,
  bpm,
  onConnect,
  onContinue,
  onSkip,
}: ConnectScreenProps) {
  const isConnected = state === 'connected'
  const isConnecting = state === 'connecting'
  const isUnsupported = state === 'unsupported'

  return (
    <div
      className="flex h-full flex-col items-center justify-between overflow-y-auto px-6 py-10 text-center"
      style={{ paddingTop: 'calc(2.5rem + var(--safe-top))', paddingBottom: 'calc(var(--nav-height) + 2rem + var(--safe-bottom))' }}
    >
      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="text-2xl font-extrabold tracking-tight text-[var(--color-primary-dark)]">Bernafas</span>
        <span className="text-sm text-[var(--color-text-muted)]">Tenang, satu nafas pada satu masa</span>
      </div>

      <div className="flex flex-col items-center gap-8">
        <div
          className={cn(
            'flex h-44 w-44 items-center justify-center rounded-full transition-all duration-500',
            isConnected ? 'bg-[var(--color-primary-light)]/25' : 'bg-white/70',
          )}
          style={{ boxShadow: '0 10px 40px rgba(63,140,140,0.15)' }}
        >
          {isConnecting ? (
            <Loader2 size={56} className="animate-spin text-[var(--color-primary)]" />
          ) : isConnected ? (
            <BluetoothConnected size={56} className="text-[var(--color-primary)]" />
          ) : (
            <Bluetooth size={56} className="text-[var(--color-accent)]" />
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            {isConnected ? 'Peranti disambung' : isConnecting ? 'Menyambung...' : 'Sambung peranti HRV anda'}
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--color-text-muted)]">
            {isUnsupported
              ? 'Pelayar ini tidak menyokong Bluetooth. Sila buka Bernafas dengan Chrome di Android, atau teruskan tanpa peranti.'
              : isConnected
              ? `${deviceName ?? 'Peranti'} · ${bpm !== null ? `${bpm} bpm` : 'menunggu bacaan...'}`
              : 'Pastikan peranti dihidupkan dan berdekatan, kemudian tekan Sambung.'}
          </p>
          {error && <p className="max-w-xs text-sm text-[var(--color-warm)]">{error}</p>}
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {isConnected ? (
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95"
          >
            Teruskan <ArrowRight size={18} />
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isConnecting || isUnsupported}
            className="flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            {isConnecting ? 'Menyambung...' : 'Sambung Peranti'}
          </button>
        )}
        <button
          onClick={onSkip}
          className="rounded-full px-6 py-3 text-sm font-medium text-[var(--color-text-muted)] underline-offset-4 hover:underline"
        >
          Teruskan tanpa peranti
        </button>
      </div>
    </div>
  )
}
