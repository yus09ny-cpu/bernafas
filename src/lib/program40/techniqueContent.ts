// Step-by-step content for all 5 techniques — paraphrased from Bab 7-11 of
// "Ini Jantungmu" (user supplied the full source text, 2026-08-19; this is
// the app's own paraphrase of it, not new/invented instructional content).
// Data-driven (not JSX) so StepGuide.tsx is one generic step-walker for all
// 5 techniques, same "content as data" convention as madrasah-iam's
// soalHatiContent.ts.
//
// showsPacer decides which steps render BreathingPulse+RingWaves:
//  - Nafas Jantung / Koheren Pantas / Nafas Sikap: every step is marked
//    true, so the pacer reads as continuous across the whole walkthrough
//    (spec item 4's "papar sepanjang sesi" falls out of that, rather than
//    being a separate always-on branch).
//  - Beku & Tanya: only Langkah 2 (Nafas Jantung) — the other 5 steps are
//    reading/reflecting/deciding, not active breath-pacing.
//  - Kunci Hati: only Langkah 1 (Nafas Jantung, the foundation) — the 4
//    "pancarkan" (radiate) steps that follow are a held felt-sense, not
//    paced breathing. This is a deliberate refinement of the ORIGINAL
//    brief (which grouped Kunci Hati with the "continuous pacer" set) after
//    the user supplied the actual per-technique pacer table, which places
//    Kunci Hati alongside Beku & Tanya's step-gated pattern instead — the
//    detailed table is what's implemented here.
//
// requiresText marks the 2 Beku & Tanya steps (Akui/Bertindak) that need a
// textarea — their combined text is what gets saved to
// program_40_day_sessions.notes (see StepGuide.tsx / ManualSessionRunner.tsx).
import type { Program40Technique } from '@/lib/program40/curriculum'

export interface TechniqueStep {
  id: string
  title: string
  description: string
  showsPacer?: boolean
  requiresText?: boolean
  textPlaceholder?: string
}

// Shared reference list for "aktifkan satu perasaan memperbaharui" — reused
// verbatim across Koheren Pantas, Beku & Tanya, and Kunci Hati's own step
// descriptions below rather than retyped per technique.
const RENEWING_FEELINGS_HINT =
  'Pilih satu: Penghargaan, Keprihatinan, Cinta, Kebaikan, Kesabaran, Belas Kasihan, Keberanian, atau Maruah. Ingat satu momen pernah rasa emosi itu, bayangkan seseorang yang disayangi, guna satu perkataan seperti "Syukur"/"Cinta"/"Tenang", atau rasa ia sebagai sensasi fizikal di dada.'

export const TECHNIQUE_STEPS: Record<Program40Technique, TechniqueStep[]> = {
  nafas_jantung: [
    { id: 'posisi', title: 'Cari Posisi Selesa', description: 'Duduk, berdiri, atau berbaring — tiada posisi yang "betul".', showsPacer: true },
    { id: 'perhatian', title: 'Letak Perhatian di Jantung', description: 'Fokuskan perhatian di kawasan jantung, tengah dada.', showsPacer: true },
    { id: 'alir', title: 'Bayangkan Nafas Mengalir', description: 'Bayangkan nafas mengalir masuk-keluar melalui jantung — bukan hidung atau mulut.', showsPacer: true },
    { id: 'perlahan', title: 'Bernafas Sedikit Lebih Perlahan', description: 'Bernafas sedikit lebih perlahan daripada biasa — tak perlu paksa atau kira.', showsPacer: true },
    { id: 'rasa', title: 'Rasa Tenaga Mengalir', description: 'Rasa tenaga mengalir turun dari kepala (fikiran, kebimbangan) ke dada.', showsPacer: true },
  ],
  koheren_pantas: [
    { id: 'fokus', title: 'Fokus di Jantung', description: 'Fokuskan perhatian di kawasan jantung.', showsPacer: true },
    { id: 'nafas', title: 'Nafas Melalui Jantung', description: 'Nafas melalui jantung, perlahan dan dalam.', showsPacer: true },
    { id: 'aktifkan', title: 'Aktifkan Satu Perasaan Memperbaharui', description: RENEWING_FEELINGS_HINT, showsPacer: true },
    { id: 'kekal', title: 'Kekalkan Perasaan Itu', description: 'Kekalkan perasaan itu sambil terus bernafas — kalau fikiran melayang, bawa balik dengan lembut, jangan marah diri sendiri.', showsPacer: true },
    { id: 'biar', title: 'Biarkan Ia Berkembang', description: 'Biarkan perasaan itu berkembang, jangan tahan atau kawal.', showsPacer: true },
  ],
  nafas_sikap: [
    { id: 'kenali', title: 'Kenali Sikap Menekan', description: 'Kenali sikap atau perasaan menekan yang ada sekarang.', showsPacer: true },
    { id: 'pilih', title: 'Pilih Sikap Pengganti', description: 'Pilih satu sikap pengganti yang lebih memperbaharui.', showsPacer: true },
    { id: 'fokus', title: 'Fokus di Jantung', description: 'Fokuskan perhatian di kawasan jantung.', showsPacer: true },
    { id: 'nafas', title: 'Nafas Melalui Jantung', description: 'Nafas melalui jantung.', showsPacer: true },
    { id: 'masuk', title: 'Bernafas Masuk Sikap Baru', description: 'Bernafas masuk sikap pengganti itu — bayangkan setiap tarikan nafas membawa masuk sikap baru tu.', showsPacer: true },
    { id: 'kekal', title: 'Kekalkan Sehingga Rasa Peralihan', description: 'Kekalkan sehingga rasa peralihan (30 saat hingga 3 minit — tak tentu, ikut rasa masing-masing).', showsPacer: true },
  ],
  beku_tanya: [
    {
      id: 'akui',
      title: 'Akui',
      description: 'Kenali situasi dan perasaan semasa. Tuliskan secara ringkas.',
      requiresText: true,
      textPlaceholder: 'Apa situasi dan perasaan anda sekarang?',
    },
    { id: 'nafas_jantung', title: 'Nafas Jantung', description: 'Fokus dan bernafas melalui jantung selama beberapa minit.', showsPacer: true },
    { id: 'aktifkan', title: 'Aktifkan Perasaan Memperbaharui', description: RENEWING_FEELINGS_HINT },
    { id: 'tanya', title: 'Tanya', description: 'Dari tempat tenang, tanya satu soalan kepada jantung — berkaitan situasi di Langkah 1.' },
    { id: 'perhatikan', title: 'Perhatikan', description: 'Dengar dan perhatikan apa respons atau intuisi yang muncul.' },
    {
      id: 'bertindak',
      title: 'Bertindak',
      description: 'Baca semula apa yang anda tulis di Langkah 1, dan buat keputusan.',
      requiresText: true,
      textPlaceholder: 'Apa keputusan/tindakan anda?',
    },
  ],
  kunci_hati: [
    { id: 'nafas_jantung', title: 'Nafas Jantung', description: 'Fondasi — fokus dan bernafas melalui jantung.', showsPacer: true },
    { id: 'aktifkan', title: 'Aktifkan Perasaan Memperbaharui', description: 'Aktifkan dan kekalkan satu perasaan memperbaharui.' },
    { id: 'diri', title: 'Pancarkan ke Diri Sendiri', description: 'Pancarkan perasaan itu kepada diri sendiri.' },
    { id: 'persekitaran', title: 'Pancarkan ke Persekitaran', description: 'Pancarkan perasaan itu ke persekitaran anda.' },
    { id: 'komuniti', title: 'Pancarkan ke Komuniti', description: 'Pancarkan perasaan itu kepada komuniti atau seseorang tertentu.' },
    { id: 'dunia', title: 'Pancarkan ke Dunia', description: 'Pancarkan perasaan itu kepada dunia atau kemanusiaan.' },
  ],
}
