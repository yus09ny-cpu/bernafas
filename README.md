# Bernafas

Front-end ringkas untuk bernafas.my — panduan pernafasan perut + skor HRV
live. Reka bentuk & jenama 100% berasingan dari Audit Jiwa, tapi **backend,
logik HRV/RMSSD, dan sambungan BLE ke peranti ESP32+MAX30102 dikongsi
sepenuhnya** dengan codebase Audit Jiwa sedia ada — tiada logik baharu
diduplikasi, hanya UI.

## Status

- [x] Struktur projek (Vite + React 19 + TS + Tailwind v4, sama stack dengan
      Audit Jiwa supaya kod boleh dikongsi/di-port dengan mudah)
- [x] Hooks/lib dikongsi (disalin dari Audit Jiwa, brand-neutral):
      `useHeartRateMonitor`, `useWakeLock`, `useAudioPulse`, `hrvCoherence.ts`
      (computeCoherence/computeRmssdMs), `bpmSmoother.ts` (BpmSmoother)
- [x] App shell — bottom nav 5 tab (Sesi/Semakan/Jurnal/Panduan/NafasCloud),
      ikon custom (`src/components/nav/`), Semakan/Jurnal/Panduan/NafasCloud
      masih placeholder "Akan datang"
- [x] Skrin Sesi — gate sambungan Bluetooth (`src/screens/ConnectScreen.tsx`)
      diikuti carousel 4 halaman boleh leret (`src/components/session/SessionCarousel.tsx`),
      semuanya paparan dari SATU stream sesi live (`useHrvSession`'s `history`):
  - Skrin 1 — cincin ringkas (waveform + dot + cincin bersegmen ikut zon koheren)
  - Skrin 2 — scene full-bleed (waveform + dot, tiada cincin)
  - Skrin 3 — mandala (cincin sama + bunga animasi + prompt bimbingan berputar)
  - Skrin 4 — ringkasan (stat bar, carta nadi/koheren/RMSSD, bacaan nadi) —
        skrol menegak, kekal terbuka semasa sesi live ATAU selepas tamat
- [ ] Placeholder "unlock bonus" (Peringkat B) — kad sedia ada, kandungan
      sebenar masih belum diputuskan (lihat `src/lib/unlockBonus.ts`)

## Reka bentuk

Palet pastel biru/mint (`src/index.css` `@theme`), font Manrope (sans moden,
bukan serif), TIADA istilah spiritual/TQN/zikir di mana-mana. Lihat
`src/index.css` untuk token warna penuh.

## Menjalankan projek

```bash
npm install
cp .env.example .env.local   # isi VITE_API_BASE_URL dengan endpoint backend Audit Jiwa
npm run dev
```

Sambungan Bluetooth (Web Bluetooth API) hanya berfungsi di Chrome/Edge desktop
atau Chrome Android — **bukan Safari/iOS**, dan perlu HTTPS atau localhost.

## Kongsi kod dengan Audit Jiwa (untuk elak drift)

Buat masa ini fail-fail dalam `src/hooks/` dan `src/lib/hrvCoherence.ts`/
`bpmSmoother.ts` disalin (bukan di-import sebagai package dikongsi) dari
`madrasah-iam/src/hooks/` dan `madrasah-iam/src/lib/`. Kalau formula HRV atau
logik BLE berubah kat repo Audit Jiwa, salin balik perubahan tu ke sini secara
manual — atau ekstrak kedua-duanya ke package npm bersama kalau drift jadi
isu (lihat brief projek asal, "Struktur teknikal dicadangkan").

## Deploy

Projek Vercel BAHARU & berasingan (bukan sama project dengan Audit Jiwa),
domain `bernafas.my`. `api/` folder disediakan kosong untuk route proxy/BFF
masa depan kalau perlu — backend sebenar tetap di Audit Jiwa, bukan di sini.
