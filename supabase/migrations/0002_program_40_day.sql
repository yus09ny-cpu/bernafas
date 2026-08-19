-- Latihan 40 Hari — enrollment + per-session log, RLS-scoped to auth.uid().
-- Run once against the Supabase project this repo is connected to
-- (POSTGRES_URL_NON_POOLING in .env.local), same as 0001_init.sql:
--   node scripts/run-migration.mjs supabase/migrations/0002_program_40_day.sql
--
-- FK target is public.profiles (id) — same convention 0001_init.sql already
-- established for public.sessions, not auth.users directly (profiles.id is
-- the same uuid as auth.users.id, kept in sync by handle_new_user()).

-- ─── program_40_day_enrollment ──────────────────────────────────────────────
-- One row per user — the program has no concept of re-enrolling in parallel
-- cohorts, so user_id is the primary key rather than a separate generated id.
-- current_day is a CACHED derived value (see spec item 5: count of distinct
-- session_date rows with a completed session, never `today - start_date`),
-- recomputed and written back every time a session is saved
-- (recomputeEnrollmentProgress in src/lib/program40/enrollment.ts) — never
-- computed from start_date + elapsed calendar time, so a missed day never
-- rolls this backward or fails the user out of the program.
create table if not exists public.program_40_day_enrollment (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  start_date date not null default (now() at time zone 'utc')::date,
  current_day int not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'paused')),
  created_at timestamptz not null default now()
);

alter table public.program_40_day_enrollment enable row level security;

create policy "program_40_day_enrollment: select own" on public.program_40_day_enrollment
  for select using (user_id = auth.uid());

create policy "program_40_day_enrollment: insert own" on public.program_40_day_enrollment
  for insert with check (user_id = auth.uid());

create policy "program_40_day_enrollment: update own" on public.program_40_day_enrollment
  for update using (user_id = auth.uid());

-- ─── program_40_day_sessions ────────────────────────────────────────────────
-- One row per completed session within the 40-day module — separate from
-- public.sessions (the freeform Sesi tab's table); a 40-day-program session
-- is never also written there. day_number/week_number/phase/technique are
-- resolved client-side at save time from the enrollment's current_day + the
-- fixed day->technique curriculum (src/lib/program40/curriculum.ts), same
-- trust model 0001_init.sql already uses for client-computed stat columns
-- (RLS enforces row *ownership*, not the arithmetic inside an owned row).
-- hrv_score is populated only when device_used = true (a real live-HRV
-- session, see Program40SessionScreen's device branch); self_rating only
-- when device_used = false (the 3-preset Tenang/Biasa/Masih Resah pattern,
-- ported from Mod Hamba's post-session pulse-check in madrasah-iam) — the
-- two columns are mutually exclusive by construction, never both non-null.
create table if not exists public.program_40_day_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_date date not null,
  day_number int not null check (day_number between 1 and 40),
  week_number int not null check (week_number between 1 and 6),
  phase text not null check (phase in ('fondasi', 'pendalaman', 'integrasi')),
  technique text not null check (
    technique in ('nafas_jantung', 'koheren_pantas', 'nafas_sikap', 'beku_tanya', 'kunci_hati')
  ),
  device_used boolean not null,
  duration_seconds int not null,
  hrv_score numeric,
  self_rating text check (self_rating in ('tenang', 'biasa', 'resah')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.program_40_day_sessions enable row level security;

create policy "program_40_day_sessions: select own" on public.program_40_day_sessions
  for select using (user_id = auth.uid());

create policy "program_40_day_sessions: insert own" on public.program_40_day_sessions
  for insert with check (user_id = auth.uid());

create policy "program_40_day_sessions: update own" on public.program_40_day_sessions
  for update using (user_id = auth.uid());

create policy "program_40_day_sessions: delete own" on public.program_40_day_sessions
  for delete using (user_id = auth.uid());

-- Dashboard's calendar + both tabs always query "this user's 40-day
-- sessions, chronological" — index the exact shape of that query.
create index if not exists program_40_day_sessions_user_id_session_date_idx
  on public.program_40_day_sessions (user_id, session_date);
