-- Program Affiliate — infrastruktur asas sahaja (pendaftaran, penjanaan PDF,
-- penjejakan). TIADA logik pengiraan komisen automatik — kadar
-- (affiliate_commission_rates.rate_value) sengaja dibiar kosong, tunggu
-- keputusan pemilik produk.
--
-- Security model: affiliates/affiliate_book_generations/affiliate_commissions/
-- affiliate_commission_rates carry no auth.uid() ownership column (the
-- Bahagian 4 schema has none — affiliates aren't Bernafas app users, they're
-- a separate identity keyed by username/email). RLS is enabled with NO anon
-- policies on those four — every read/write goes through api/affiliate/*.ts
-- using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS by design), never raw
-- client-side supabase-js calls. This is deliberate: without auth.uid() to
-- scope rows to, an anon SELECT policy on `affiliates` would let anyone with
-- the public anon key dump every affiliate's email address. affiliate_clicks
-- is the one exception — insert-only, anon-safe (see below).

create extension if not exists pgcrypto;

-- ─── orders ──────────────────────────────────────────────────────────────
-- Did NOT exist in this repo before this migration (confirmed — no api/
-- routes, no ToyyibPay integration). Created here as the minimal skeleton
-- affiliate_commissions.order_id needs to point at, plus affiliate_ref
-- (spec item 1's "tambah lajur ke orders sedia ada" — sedia ada here means
-- "once this migration lands", not "already existed"). Payment/ToyyibPay
-- completion logic itself is a separate, later piece of work — this table
-- only needs to exist and accept an affiliate_ref.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  email text,
  product_type text not null check (product_type in ('buku', 'pakej_lifetime')),
  amount numeric,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  toyyibpay_bill_code text,
  -- Spec item 1 — diisi dari query param/cookie semasa checkout (/beli?ref=...,
  -- 30-hari cookie). Nullable: bukan semua order datang dari affiliate.
  affiliate_ref text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.orders enable row level security;
-- No anon policies — orders are only ever written/read via api/*.ts using
-- the service-role key (ToyyibPay callback, checkout creation), same
-- reasoning as affiliates below.

-- ─── affiliates ──────────────────────────────────────────────────────────
create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text not null,
  email text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

alter table public.affiliates enable row level security;
-- No anon policies — see file header. Registration (api/affiliate/register.ts)
-- and dashboard reads (api/affiliate/dashboard.ts) both use the service-role
-- key server-side.

-- ─── affiliate_book_generations ─────────────────────────────────────────
-- One row per (affiliate, book_version) PDF actually generated — the cache
-- the PDF generation service checks before regenerating. book_version lets
-- a future book update invalidate old cached PDFs without touching rows for
-- versions still valid.
create table if not exists public.affiliate_book_generations (
  id uuid primary key default gen_random_uuid(),
  affiliate_username text not null references public.affiliates (username) on delete cascade,
  book_version text not null,
  pdf_storage_path text not null,
  generated_at timestamptz not null default now()
);

alter table public.affiliate_book_generations enable row level security;
-- No anon policies — generation service (api/affiliate/book.ts) reads/writes
-- via service-role key only.

create index if not exists affiliate_book_generations_lookup_idx
  on public.affiliate_book_generations (affiliate_username, book_version);

-- ─── affiliate_clicks ────────────────────────────────────────────────────
-- The ONE affiliate table anon can write to directly — /beli?ref=USERNAME
-- (public landing page, no auth) inserts a row per visit. Insert-only:
-- anon can never SELECT from this table (dashboard counts are read via
-- api/affiliate/dashboard.ts using the service-role key, never client-side),
-- so an anon key holder can add junk click rows but can never read anyone's
-- click data.
create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_username text not null references public.affiliates (username) on delete cascade,
  clicked_at timestamptz not null default now()
);

alter table public.affiliate_clicks enable row level security;

create policy "affiliate_clicks: anon insert" on public.affiliate_clicks
  for insert with check (true);

create index if not exists affiliate_clicks_username_idx
  on public.affiliate_clicks (affiliate_username);

-- ─── affiliate_commissions ───────────────────────────────────────────────
create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_username text not null references public.affiliates (username) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now()
);

alter table public.affiliate_commissions enable row level security;
-- No anon policies — dashboard reads counts via api/affiliate/dashboard.ts
-- (service-role key). No row here is ever created by this migration's own
-- code either — commission-creation logic is explicitly OUT of scope until
-- the rate decision lands (see affiliate_commission_rates below).

create index if not exists affiliate_commissions_username_idx
  on public.affiliate_commissions (affiliate_username);

-- ─── affiliate_commission_rates ──────────────────────────────────────────
-- rate_value is deliberately left NULL by this migration — DO NOT default
-- it to 0 or any other number, and do not write any code that reads this
-- table to compute a commission amount yet. product_type is the primary
-- key (one rate per product type, not one row per affiliate — a global
-- rate table), matching the schema exactly as given.
create table if not exists public.affiliate_commission_rates (
  product_type text primary key check (product_type in ('buku', 'pakej_lifetime')),
  rate_type text check (rate_type in ('percent', 'fixed')),
  rate_value numeric
);

alter table public.affiliate_commission_rates enable row level security;
-- No anon policies — rates are an internal admin concern, set later via the
-- Supabase SQL editor directly (same pattern this repo already uses for
-- admin-only config elsewhere), not through any app-facing route in this
-- round of work.

-- Seed the two known product types with rate_value left NULL — establishes
-- the row shape without deciding a number. Safe to run again (upsert-style).
insert into public.affiliate_commission_rates (product_type, rate_type, rate_value)
values ('buku', null, null), ('pakej_lifetime', null, null)
on conflict (product_type) do nothing;
