// Skrin 1 header consolidation, round 2: the inline DeviceConnect pill
// (full device name) + SmoothnessSetting icon were still two separate
// elements in the header row — fine for a short device name, but a longer
// real BLE advertised name has no ceiling, so the row's width requirement
// was never actually bounded. This folds both into ONE fixed-size icon
// button; the device name/disconnect/smoothness controls all move into its
// popup instead, so the header row's width no longer depends on device-name
// length at all. See DeviceConnect.tsx / SmoothnessSetting.tsx — this
// doesn't replace either (SmoothnessSetting is still used standalone
// nowhere else, but its slider markup/labels are intentionally mirrored
// here rather than imported, since the trigger and layout differ enough
// that sharing the button component would need its own indirection).
import { Bluetooth, BluetoothConnected, Loader2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { smoothnessLabel } from '@/components/session/SmoothnessSetting'
import type { HeartRateDevice } from '@/hooks/useHeartRateDevice'

export function DeviceSettingsPopover({
  device,
  smoothness,
  onSmoothnessChange,
}: {
  device: HeartRateDevice
  smoothness: number
  onSmoothnessChange: (value: number) => void
}) {
  const { status, deviceName, error, hasRr, connect, disconnect } = device
  const connected = status === 'connected'
  const connecting = status === 'connecting'

  const statusText =
    status === 'unsupported' ? 'Bluetooth tiada pada peranti ini' : connecting ? 'Menyambung…' : connected ? (deviceName ?? 'Tersambung') : 'Tiada peranti disambung'

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Peranti sensor & tetapan"
        className="grid size-9 place-items-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/40"
      >
        {connecting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : connected ? (
          <BluetoothConnected className="size-4" aria-hidden />
        ) : (
          <Bluetooth className="size-4" aria-hidden />
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Peranti sensor</p>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={statusText}>
              {statusText}
            </p>
            {connected && !hasRr && <p className="mt-1 text-xs text-muted-foreground">Peranti tidak hantar selang RR — koheren dianggarkan.</p>}
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
            <button
              type="button"
              onClick={connected ? disconnect : connect}
              disabled={connecting || status === 'unsupported'}
              className="mt-3 w-full rounded-full bg-card/70 px-3 py-2 text-xs font-medium text-muted-foreground shadow-[var(--shadow-soft)] backdrop-blur transition-colors hover:text-foreground disabled:opacity-60"
            >
              {connected ? 'Putuskan peranti' : 'Sambung sensor'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Kelancaran peralihan nafas</p>
              <p className="mt-1 text-xs text-muted-foreground">Melaraskan lengkung pergerakan antara tarik dan hembus nafas.</p>
            </div>
            <Slider value={[smoothness]} min={0} max={2} step={0.05} onValueChange={([v]) => onSmoothnessChange(v ?? 1)} aria-label="Intensiti kelancaran" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tajam</span>
              <span className="font-medium text-primary">{smoothnessLabel(smoothness)}</span>
              <span className="text-muted-foreground">Lembut</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
