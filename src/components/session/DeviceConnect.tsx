// Ported verbatim from calm-breath-pulse's src/components/session/DeviceConnect.tsx
// for Skrin 1. `device` is real (built in useHrvSession.ts from Bernafas's
// single live BLE connection), never a second/mock connection.
import { Bluetooth, BluetoothConnected, Loader2 } from 'lucide-react'
import type { HeartRateDevice } from '@/hooks/useHeartRateDevice'

export function DeviceConnect({ device }: { device: HeartRateDevice }) {
  const { status, deviceName, error, hasRr, connect, disconnect } = device
  const connected = status === 'connected'
  const connecting = status === 'connecting'

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={connected ? disconnect : connect}
        disabled={connecting || status === 'unsupported'}
        aria-label={connected ? 'Putuskan peranti' : 'Sambung peranti HR'}
        className="flex items-center gap-2 rounded-full bg-card/70 px-3 py-2 text-xs font-medium text-muted-foreground shadow-[var(--shadow-soft)] backdrop-blur transition-colors hover:text-foreground disabled:opacity-60"
      >
        {connecting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : connected ? (
          <BluetoothConnected className="size-4 text-primary" aria-hidden />
        ) : (
          <Bluetooth className="size-4" aria-hidden />
        )}
        <span className="max-w-28 truncate">
          {status === 'unsupported' ? 'Bluetooth tiada' : connecting ? 'Menyambung…' : connected ? (deviceName ?? 'Tersambung') : 'Sambung sensor'}
        </span>
      </button>
      {connected && !hasRr && <p className="text-[10px] text-muted-foreground">Peranti tidak hantar selang RR — koheren dianggarkan.</p>}
      {error && <p className="max-w-48 text-right text-[10px] text-destructive">{error}</p>}
    </div>
  )
}
