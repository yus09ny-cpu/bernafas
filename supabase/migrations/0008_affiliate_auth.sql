-- Affiliate login (spec item 2): links an existing `affiliates` row to the
-- Supabase Auth identity (auth.users) they sign in with on first login.
-- Affiliates are still a separate identity from Bernafas app users (see
-- 0003_affiliate_program.sql's header) — this column doesn't make every
-- affiliate an "app user" in any other sense, it's purely how
-- api/affiliate.ts's handleMe (action=me) recognizes "which affiliate row
-- does this signed-in session belong to" instead of trusting a
-- client-supplied id (the old capability-link mechanism, which stays as a
-- secondary access path — see that file's own comments).
--
-- Nullable (most rows start unlinked), unique (one auth identity can only
-- ever own one affiliate account), `on delete set null` rather than
-- cascade — deleting the auth identity (e.g. the person deletes their
-- Google-linked Bernafas account entirely) must NOT delete the affiliate's
-- historical clicks/commissions, those are a business record independent
-- of whether they can currently log in to view them.
alter table public.affiliates
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists affiliates_auth_user_id_idx on public.affiliates (auth_user_id) where auth_user_id is not null;
