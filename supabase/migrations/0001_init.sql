-- Session persistence — profiles + sessions, RLS-scoped to auth.uid().
-- Run once against the Supabase project this repo is connected to
-- (POSTGRES_URL_NON_POOLING in .env.local); see scripts/run-migration.mjs.

create extension if not exists pgcrypto;

-- ─── profiles ────────────────────────────────────────────────────────────
-- One row per auth.users row. id is the SAME uuid as auth.users.id (not a
-- separate generated key) so joining/scoping never needs an extra lookup.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles: insert own" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid());

-- Auto-creates the profiles row the instant a user completes their first
-- magic-link login (a new auth.users row appears) — not left to a
-- client-side "create profile if missing" call after login, which could
-- race or silently fail to run.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── sessions ────────────────────────────────────────────────────────────
-- One row per completed (or in-progress-then-ended) breathing session.
-- coherence_avg/achievement_pct/avg_bpm/low_pct/medium_pct/high_pct are the
-- same computeSessionStats() output Skrin 4 already shows, written once at
-- session end — not recomputed from `history` on read. `history` keeps the
-- full per-sample array (t, coherenceAlt, bpm) so a future Review detail
-- page can redraw the same charts Skrin 4 shows, without re-deriving stats
-- that could drift from what was actually shown live.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null,
  duration_sec int,
  coherence_avg numeric,
  achievement_pct numeric,
  avg_bpm numeric,
  low_pct numeric,
  medium_pct numeric,
  high_pct numeric,
  history jsonb,
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "sessions: select own" on public.sessions
  for select using (user_id = auth.uid());

create policy "sessions: insert own" on public.sessions
  for insert with check (user_id = auth.uid());

create policy "sessions: update own" on public.sessions
  for update using (user_id = auth.uid());

create policy "sessions: delete own" on public.sessions
  for delete using (user_id = auth.uid());

-- Review's future list page will always query "this user's sessions,
-- newest first" — index the exact shape of that query now.
create index if not exists sessions_user_id_started_at_idx
  on public.sessions (user_id, started_at desc);
