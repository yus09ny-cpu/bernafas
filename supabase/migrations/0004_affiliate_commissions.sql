-- Program Affiliate — logik pengiraan komisen. Kadar sekarang DIPUTUSKAN
-- (15% asas, +5% bonus prestasi lepas 20 jualan sebulan, +5% override
-- rujukan 2-tahap) — lihat api/_lib/commissions.ts untuk pengiraan sebenar.
-- Kadar-kadar ini adalah PEMALAR dalam kod, BUKAN dibaca dari
-- affiliate_commission_rates (jadual tu kekal kosong/tak dipakai — reka
-- bentuk asalnya per-product_type, tapi kadar sebenar yang diputuskan
-- tak varies ikut product_type langsung, jadi tak sepadan dengan bentuk
-- jadual tu; pemalar kod lebih jujur daripada paksa isi jadual dengan
-- nilai yang tak pernah dibaca).

-- ─── affiliates.referred_by_username ────────────────────────────────────
-- Nullable — affiliate tanpa upline (paling ramai, terutamanya kohort
-- pertama) tak isi lajur ni langsung. Diisi sekali sahaja semasa
-- pendaftaran (api/affiliate/register.ts, dari query param ?ref=), tak
-- pernah diubah selepas tu.
alter table public.affiliates
  add column if not exists referred_by_username text references public.affiliates (username) on delete set null;

-- ─── affiliate_commissions.commission_type / rate_applied ───────────────
-- commission_type membezakan komisen jualan sendiri ('sale') daripada
-- override rujukan 2-tahap ('referral_override') — SATU order 'paid' yang
-- ada upline boleh hasilkan DUA baris (satu untuk setiap jenis), bukan
-- satu baris dengan dua kadar. rate_applied simpan kadar SEBENAR dipakai
-- (0.15/0.20/0.05) untuk audit — supaya kalau kadar asas berubah pada
-- masa depan, baris lama kekal menunjukkan kadar yang betul-betul dipakai
-- pada masa order tu diproses, bukan kadar semasa.
alter table public.affiliate_commissions
  add column if not exists commission_type text check (commission_type in ('sale', 'referral_override')),
  add column if not exists rate_applied numeric;

-- ─── Index untuk kiraan bulanan (bilangan jualan 'paid' sebulan) ────────
-- api/_lib/commissions.ts's recordCommissionsForPaidOrder() kira
-- "berapa order 'paid' affiliate ni ada dalam bulan kalendar semasa" —
-- corak query tepat ni tak ada index sebelum ni (orders.affiliate_ref
-- langsung tiada index, migration 0003 tak sangka corak query ni akan
-- wujud).
create index if not exists orders_affiliate_ref_status_created_idx
  on public.orders (affiliate_ref, status, created_at);

-- ─── Index untuk semakan idempoten (order_id) ───────────────────────────
-- recordCommissionsForPaidOrder() semak baris sedia ada bagi order_id
-- yang sama sebelum insert (elak double-komisen kalau ToyyibPay ulang
-- hantar callback yang sama).
create index if not exists affiliate_commissions_order_id_idx
  on public.affiliate_commissions (order_id);
