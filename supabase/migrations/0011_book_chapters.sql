-- book_chapters — backs the in-app reader (api/book/chapter.ts) that
-- replaces the PDF-download delivery of the full 13-bab book
-- (api/book/full.ts, kept but no longer linked from the UI — a downloaded
-- PDF can be redistributed freely once out, an in-app reader isn't).
--
-- One row per chapter, keyed by chapter_number (0 = Pengenalan, 1-13 =
-- Bab 1-13, 99 = Lampiran A+B+C combined into one row) — populated once by
-- scripts/parse-book-chapters.mjs (deleted after use, not a kept repo
-- utility) parsing buku/INI_JANTUNGMU_A5_dengan_CTA_3_Jalan_1.docx.
--
-- Deliberately NO book_version column (unlike book_generations /
-- affiliate_book_generations): those cache an expensive CloudConvert PDF
-- render that a version bump must invalidate. Reading a chapter here is a
-- plain DB read — cheap enough that re-running the parse script after a
-- future docx edit can just upsert the same 15 rows in place, no
-- cache-invalidation scheme needed.
create table if not exists public.book_chapters (
  id uuid primary key default gen_random_uuid(),
  chapter_number int not null unique,
  title text not null,
  content_html text not null,
  created_at timestamptz not null default now()
);

alter table public.book_chapters enable row level security;
-- No anon policies — read only via api/book/chapter.ts (service-role key),
-- written only by the one-off parse script (also service-role key), same
-- reasoning as book_generations/affiliate_book_generations.
