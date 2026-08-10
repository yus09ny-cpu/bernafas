// Ported verbatim from calm-breath-pulse's src/components/session/SmoothnessSetting.tsx
// for Skrin 1.
import { Settings2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'

export const SMOOTHNESS_PRESETS = [
  { max: 0.34, label: 'Tajam' },
  { max: 0.84, label: 'Sederhana' },
  { max: 1.34, label: 'Semula jadi' },
  { max: 2, label: 'Sangat lembut' },
] as const

export function smoothnessLabel(value: number) {
  return SMOOTHNESS_PRESETS.find(p => value <= p.max)?.label ?? 'Semula jadi'
}

export function SmoothnessSetting({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Tetapan kelancaran nafas"
        className="grid size-10 place-items-center rounded-full bg-card/70 text-muted-foreground shadow-[var(--shadow-soft)] backdrop-blur transition-colors hover:text-foreground"
      >
        <Settings2 className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Kelancaran peralihan nafas</p>
            <p className="mt-1 text-xs text-muted-foreground">Melaraskan lengkung pergerakan antara tarik dan hembus nafas.</p>
          </div>
          <Slider value={[value]} min={0} max={2} step={0.05} onValueChange={([v]) => onChange(v ?? 1)} aria-label="Intensiti kelancaran" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tajam</span>
            <span className="font-medium text-primary">{smoothnessLabel(value)}</span>
            <span className="text-muted-foreground">Lembut</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
