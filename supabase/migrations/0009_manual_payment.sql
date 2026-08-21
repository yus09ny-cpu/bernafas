-- Manual "Wise (Antarabangsa)" payment path — ToyyibPay only processes
-- MYR, so buyers outside Malaysia (e.g. Singapore) need an alternative:
-- upload a payment-proof screenshot, an admin reviews and approves it,
-- and approval reuses the EXACT same order-paid logic ToyyibPay's webhook
-- already uses (api/_lib/markOrderPaid.ts, extracted from
-- api/checkout/callback.ts this same session) — never a parallel
-- "manually flip status to paid" path that could drift from the real one.

-- ─── orders.status: add 'pending_verification' ───────────────────────────
-- A manual-payment order sits here (not 'pending' — that's ToyyibPay's own
-- "bill created, not yet paid" state) between proof submission and admin
-- review. Never auto-transitions to 'paid' — only markOrderPaid (via
-- manual-payment.ts's approve action) does that, same as a real ToyyibPay
-- callback.
alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'pending_verification', 'paid', 'failed', 'cancelled'));

-- ─── manual_payment_proofs ─────────────────────────────────────────────
-- One row per payment-proof submission. order_id is UNIQUE — a buyer
-- resubmitting (e.g. after a rejection) creates a NEW order + NEW proof
-- row rather than overwriting this one, so a rejected attempt's proof
-- image/history is never lost.
create table if not exists public.manual_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  proof_image_path text not null,
  submitted_email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.manual_payment_proofs enable row level security;
-- No anon policies — same reasoning as `orders`/`order_shipping`
-- themselves (real PII: a payment-proof screenshot + the buyer's e-mail).
-- Every read/write goes through api/checkout/manual-payment.ts, which
-- uses the service-role key: the buyer-submit action (no auth required,
-- matching /beli's own guest-checkout model) and the admin
-- list/approve/reject actions (hasAdminRole(user, 'admin') guard, same
-- tier as /admin/penghantaran).

create index if not exists manual_payment_proofs_status_idx on public.manual_payment_proofs (status);
