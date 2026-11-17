-- LinguaMaestro — scope vocabulary introduction to individual lessons
-- Run this in the Supabase SQL Editor on top of 0001-0006.
-- Idempotent: safe to re-run.
--
-- SRS seeding (POST /lessons/:lessonId/complete) pulls every
-- vocabulary_reference row matching the lesson's language+level and seeds
-- all of them at once. With ~10 words/level this was barely noticeable; now
-- that a level can carry 50-60+ words, completing the very first lesson at
-- a level would dump the learner's entire level vocabulary into their SRS
-- queue in one shot — including dozens of words they've never actually
-- seen in a lesson yet. That's the opposite of good spaced-repetition
-- pacing (SRS should reinforce what you've just learned, not front-load
-- everything at once).
--
-- lesson_id is nullable and additive: existing vocabulary_reference rows
-- (and any future content that doesn't set it) keep working exactly as
-- before via the level-wide fallback in application code — this only
-- narrows seeding for words that explicitly opt in by being tied to a
-- lesson.

alter table public.vocabulary_reference
  add column if not exists lesson_id uuid references public.lessons (id) on delete set null;

create index if not exists vocabulary_reference_lesson_idx
  on public.vocabulary_reference (lesson_id);
