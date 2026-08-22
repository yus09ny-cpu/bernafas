-- Affiliate commission payout via Wise (spec: affiliate gives their Wise
-- account email, admin pays them manually in the Wise app itself — no
-- payment API integration, just a place to record the email and a place to
-- mark rows paid). Bank-transfer fields were considered and explicitly
-- rejected by the product owner in favour of Wise (simpler for them to
-- manage) — see api/affiliate.ts's action=updateWiseEmail comment.

-- ─── affiliates.wise_email ────────────────────────────────────────────────
-- Nullable — most affiliates haven't filled this in yet at migration time.
-- Sensitive-ish (identifies where a real payout lands) but not secret the
-- way a password is — same access model as affiliates.email already has:
-- no anon RLS policy reads it, only api/affiliate.ts (service-role key)
-- touches it, gated to the SIGNED-IN affiliate's own row via auth_user_id
-- (0008_affiliate_auth.sql), never trusted from a client-supplied id/
-- username. Admin reads it via api/admin/commissions.ts, hasAdminRole(user,
-- 'super') — one tier above /admin/penghantaran's 'admin' floor, matching
-- 0007_admin_roles.sql's own header ("'super' = product/order/affiliate
-- management").
alter table public.affiliates
  add column if not exists wise_email text;

-- ─── affiliate_commissions.paid_at ────────────────────────────────────────
-- Set once, when an admin marks a row 'paid' (api/admin/commissions.ts).
-- Same naming convention as orders.paid_at (0003_affiliate_program.sql).
alter table public.affiliate_commissions
  add column if not exists paid_at timestamptz;
