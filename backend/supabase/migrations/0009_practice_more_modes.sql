-- LinguaMaestro — deepen Practice: multiple choice, fill-the-blank, pronunciation
-- Run this in the Supabase SQL Editor on top of 0001-0008.
-- Idempotent: safe to re-run.
--
-- Practice had 4 modes (speaking, shadowing, debate, writing), none of them
-- auto-graded against a known-correct answer. Three new modes close that
-- gap and reuse the exact exercise types already proven in Learn:
--   - multiple_choice: a question + 4 options, graded by exact match.
--   - fill_blank: a sentence with "___", graded by fuzzy match (reuses the
--     same tolerance as Learn's FillBlank and Reorder components).
--   - pronunciation: read `reference_text` aloud; the browser's own speech
--     recognition produces a transcript, graded by fuzzy match against it.
--     No server-side audio/Whisper pipeline — that whole dependency was
--     removed with the exam feature (0008); this is intentionally simpler.

alter table public.practice_prompts
  add column if not exists options text[],
  add column if not exists correct_answer text;

alter table public.practice_prompts
  drop constraint if exists practice_prompts_mode_check;
alter table public.practice_prompts
  add constraint practice_prompts_mode_check
  check (mode in ('speaking', 'shadowing', 'debate', 'writing', 'multiple_choice', 'fill_blank', 'pronunciation'));
