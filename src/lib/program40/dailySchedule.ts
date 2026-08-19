// Jadual Harian ikut fasa — dari Bab 13 buku "Ini Jantungmu" (kandungan
// diberi terus oleh user, 2026-08-19). SATU sumber data untuk DUA konsumer:
// JadualHarianCard.tsx (papar terus) DAN curriculum.ts's
// suggestTechniqueForNow() (cadangan lalai TechniquePicker) — supaya kedua
// tak boleh tak-sinkron dengan senarai berasingan.
import type { Program40Phase, Program40Technique } from '@/lib/program40/curriculum'

export type ScheduleSlot = 'pagi' | 'sepanjang_hari' | 'malam' | 'bila_perlu'

export interface DailyScheduleEntry {
  slot: ScheduleSlot
  label: string
  // More than one technique means "either/both" for that slot (e.g.
  // Pendalaman's pagi = Nafas Jantung + Koheren Pantas together) — never
  // more than the set already unlocked for the entry's own phase (see
  // curriculum.ts's getAvailableTechniquesForDay, kept consistent by hand).
  techniques: Program40Technique[]
  durationLabel: string
  purpose: string
}

export const DAILY_SCHEDULE: Record<Program40Phase, DailyScheduleEntry[]> = {
  fondasi: [
    { slot: 'pagi', label: 'Pagi', techniques: ['nafas_jantung'], durationLabel: '2-3 minit', purpose: 'Berhubung. Mengingat. Menetapkan nada.' },
    { slot: 'sepanjang_hari', label: 'Sepanjang hari', techniques: ['koheren_pantas'], durationLabel: '1-3 minit (bila perlu)', purpose: 'Reset. Kembali. Memilih.' },
    { slot: 'malam', label: 'Malam', techniques: ['nafas_jantung'], durationLabel: '3-5 minit', purpose: 'Menenangkan. Melepaskan hari.' },
  ],
  pendalaman: [
    { slot: 'pagi', label: 'Pagi', techniques: ['nafas_jantung', 'koheren_pantas'], durationLabel: '3-5 minit', purpose: 'Berhubung. Mengisi tangki.' },
    { slot: 'sepanjang_hari', label: 'Sepanjang hari', techniques: ['nafas_sikap'], durationLabel: '3-5 minit (bila perlu)', purpose: 'Mengubah cuaca dalaman.' },
    { slot: 'bila_perlu', label: 'Bila perlu', techniques: ['beku_tanya'], durationLabel: '5-10 minit', purpose: 'Mendengar intuisi.' },
    { slot: 'malam', label: 'Malam', techniques: ['nafas_jantung'], durationLabel: '5 minit', purpose: 'Menenangkan. Melepaskan.' },
  ],
  integrasi: [
    { slot: 'pagi', label: 'Pagi', techniques: ['kunci_hati'], durationLabel: '5-10 minit', purpose: 'Mengisi tangki. Memancarkan. Menetapkan nada.' },
    { slot: 'sepanjang_hari', label: 'Sepanjang hari', techniques: ['koheren_pantas', 'nafas_sikap'], durationLabel: '1-5 minit', purpose: 'Reset. Memilih. Mengubah.' },
    { slot: 'bila_perlu', label: 'Bila perlu', techniques: ['beku_tanya'], durationLabel: '5-10 minit', purpose: 'Mendengar intuisi.' },
    { slot: 'malam', label: 'Malam', techniques: ['nafas_jantung'], durationLabel: '5 minit', purpose: 'Menenangkan. Melepaskan. Bersyukur.' },
  ],
}

// Which slot "now" falls into, by local hour — 'bila_perlu' is deliberately
// never returned here (per user's own note: Beku & Tanya is for a specific
// situation, not a fixed time of day, so it must never be the automatic
// suggestion driven purely by the clock).
export function getSlotForHour(hour: number): Exclude<ScheduleSlot, 'bila_perlu'> {
  if (hour < 12) return 'pagi'
  if (hour >= 18) return 'malam'
  return 'sepanjang_hari'
}
