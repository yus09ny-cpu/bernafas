-- Physical-sensor shipping addresses + fulfillment status, and a one-time
-- completion guard for the 40-day program's admin notice.

-- ─── order_shipping ───────────────────────────────────────────────────────
-- One row per order (unique order_id) — captured once via
-- api/shipping/save.ts right after a 'sensor'/'pakej_lifetime' order pays,
-- never overwritten after that (spec: "sekali sahaja"). Deliberately a
-- SEPARATE table from `orders` rather than more columns bolted onto it —
-- orders is a payment/financial record, order_shipping is a fulfillment
-- record with its own independent lifecycle (a paid order might sit for
-- days before an address is even collected).
create table if not exists public.order_shipping (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  address text not null,
  postcode text not null,
  state text not null,
  shipping_status text not null default 'belum_hantar' check (shipping_status in ('belum_hantar', 'dihantar')),
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.order_shipping enable row level security;
-- No anon policies — same reasoning as `orders` itself
-- (0003_affiliate_program.sql's own header): every read/write goes through
-- api/shipping/*.ts (ownership verified server-side against the order's
-- user_id/email) and api/admin/*.ts (server-side admin-email check), never
-- a client-side supabase-js call an anon key could exploit directly. A
-- shipping address is real PII (name, phone, home address) — this table
-- specifically must never get an anon SELECT policy. RLS enabled + zero
-- policies means everything but service_role is denied by default; no
-- explicit deny policy needed (same as orders/affiliates/
-- affiliate_book_generations, all zero-policy tables already).

create index if not exists order_shipping_status_idx on public.order_shipping (shipping_status);

-- ─── program_40_day_enrollment: one-time completion-notice guard ─────────
-- recomputeEnrollmentProgress (src/lib/program40/enrollment.ts) recomputes
-- and writes `status` on EVERY session save, so `status = 'completed'`
-- alone is true on every save after day 40, not just the first time — this
-- column is what api/notify/program40-completed.ts checks-and-sets to make
-- sure the one admin notice only ever fires once per user, not once per
-- session saved after completion.
alter table public.program_40_day_enrollment
  add column if not exists completed_notified_at timestamptz;
