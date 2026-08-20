-- Sensor-only product (RM350), recurring RM19.90/bulan app-access
-- subscription, and full-book (13 bab) purchase-gated delivery.
--
-- Rollout note (deliberate, confirmed with product owner 2026-08-20): this
-- migration + the checkout/callback/cron code that reads it are built and
-- testable end-to-end, but App.tsx does NOT enforce subscription_tier yet —
-- every signed-in user still gets full app access regardless of this
-- column's value. Wiring that gate is a separate, later decision (rollout
-- strategy for EXISTING users — grandfather or not — still undecided).
-- Don't treat subscription_tier/subscription_expiry existing as evidence
-- the gate is live; check App.tsx itself.

-- ─── orders.product_type: add 'sensor' + 'app_subscription' ─────────────
-- Real constraint name confirmed against production (pg_constraint), not
-- guessed — see this session's own verification query before writing this.
alter table public.orders
  drop constraint if exists orders_product_type_check;

alter table public.orders
  add constraint orders_product_type_check
  check (product_type in ('buku', 'pakej_lifetime', 'sensor', 'app_subscription'));

-- ─── orders.user_id ───────────────────────────────────────────────────────
-- Did NOT exist before this migration — orders only ever carried a plain
-- `email` text field (guest-checkout friendly, /beli is deliberately
-- unauthenticated per src/main.tsx's PublicRoot comment). Nullable and
-- ON DELETE SET NULL (not cascade) — an order is a financial/audit record,
-- it should survive a deleted account, same reasoning as madrasah-iam's
-- payment_events.matched_profile_id.
--
-- Populated by api/checkout/create-bill.ts ONLY when the caller sends a
-- valid Authorization: Bearer <access_token> header (optional for
-- 'buku'/'pakej_lifetime'/'sensor' — guest checkout still works with just
-- email; REQUIRED for 'app_subscription', which only makes sense for a
-- signed-in user in the first place). Full-book access
-- (api/book/full.ts) checks user_id first, falls back to a
-- case-insensitive email match for orders placed while signed out.
alter table public.orders
  add column if not exists user_id uuid references public.profiles (id) on delete set null;

create index if not exists orders_user_id_idx on public.orders (user_id);

-- ─── profiles: app-access subscription state ─────────────────────────────
-- Same shape as madrasah-iam's profiles.subscription_tier/subscription_expiry
-- (reused pattern per spec, not reinvented) — adapted to bernafas's simpler
-- two-state model ('free' | 'active'; no pro/pro_plus tiers here).
-- subscription_expiry = NULL means "never had an active subscription" for a
-- 'free'-tier profile; check-subscriptions.ts's downgrade query only ever
-- touches rows where it's NOT null (see that file), so a future manual
-- "grandfather this user" (tier='active', expiry=NULL) is safe from
-- accidental auto-downgrade by construction, not by convention.
alter table public.profiles
  add column if not exists subscription_tier text not null default 'free' check (subscription_tier in ('free', 'active')),
  add column if not exists subscription_expiry timestamptz,
  add column if not exists last_reminder_sent timestamptz;

-- api/check-subscriptions.ts's daily cron queries exactly this shape
-- (tier='active' AND expiry in some range) — no index existed for it.
create index if not exists profiles_subscription_tier_expiry_idx
  on public.profiles (subscription_tier, subscription_expiry);

-- ─── book_generations ──────────────────────────────────────────────────
-- Cache for the full (13-bab) book PDF — deliberately GLOBAL (one row per
-- book_version, not per-buyer/per-affiliate like affiliate_book_generations).
-- Unlike the affiliate magnet excerpt, the full book's docx carries no
-- {{AFFILIATE_REF}} (or any other) per-buyer token — every purchaser reads
-- byte-identical content — confirmed by inspecting
-- buku/INI_JANTUNGMU_A5_dengan_CTA_3_Jalan_1.docx directly before writing
-- this (both its "Jalan 2"/"Jalan 3" CTA links are static bernafas.my URLs).
-- So there is exactly one PDF to generate-and-cache per book_version, ever,
-- regardless of how many people buy it.
create table if not exists public.book_generations (
  id uuid primary key default gen_random_uuid(),
  book_version text not null unique,
  pdf_storage_path text not null,
  generated_at timestamptz not null default now()
);

alter table public.book_generations enable row level security;
-- No anon policies — api/book/full.ts reads/writes via service-role key
-- only, same reasoning as affiliate_book_generations.
