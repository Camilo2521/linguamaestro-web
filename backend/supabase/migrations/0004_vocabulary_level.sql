-- LinguaMaestro — vocabulary CEFR level
-- Run this in the Supabase SQL Editor on top of 0001-0003.
-- Idempotent: safe to re-run.
--
-- `vocabulary_reference` had no level column — every word for a language
-- was one undifferentiated pool, so there was no way to seed a beginner's
-- SRS deck with only A1 words (they'd get NATIVE-level vocabulary on day
-- one). Lessons already carry a `level`; vocabulary needs the same so it
-- can be scoped the same way.

alter table public.vocabulary_reference
  add column if not exists level cefr_level;

-- Table is expected to be empty at this point (seed content loads after
-- this migration) — otherwise existing rows would need a backfill before
-- this could safely become NOT NULL.
alter table public.vocabulary_reference
  alter column level set not null;

create index if not exists vocabulary_reference_language_level_idx
  on public.vocabulary_reference (language_code, level);
