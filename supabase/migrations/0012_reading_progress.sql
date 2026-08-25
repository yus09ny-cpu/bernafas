-- "Sambung Membaca" — the book reader's auto-bookmark. Added directly to
-- profiles (not a new reading_progress table): this is "one value per
-- user" state, same shape as subscription_tier/admin_role/
-- last_reminder_sent already on this table, not a history log — no need
-- for a separate table with its own RLS just to hold two columns.
--
-- No new RLS policy needed either — profiles already has "select own"/
-- "update own" policies scoped to auth.uid() (0001_init.sql), which is
-- exactly the access shape this needs: the client writes/reads its own
-- last_read_chapter directly via supabase-js (src/lib/bookReader.ts),
-- same established pattern as src/lib/program40/enrollment.ts's direct
-- client-side .update() calls — no new api/ route for this.
alter table public.profiles
  add column if not exists last_read_chapter int,
  add column if not exists last_read_at timestamptz;
