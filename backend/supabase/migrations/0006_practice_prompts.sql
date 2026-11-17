-- LinguaMaestro — practice prompts (speaking, shadowing, debate, writing)
-- Run this in the Supabase SQL Editor on top of 0001-0005.
-- Idempotent: safe to re-run.
--
-- The Practice section had zero backend-driven content: every prompt was
-- hardcoded in the frontend, ignored the learner's target language entirely
-- (only level was used), covered just 3 of 7 levels for shadowing, and had
-- no writing mode at all. This table gives Practice the same reference-data
-- model lessons/vocabulary_reference already use, scoped by language AND
-- level AND mode, so content can actually be complete.

create table if not exists public.practice_prompts (
  id uuid primary key default gen_random_uuid(),
  language_code language_code not null,
  level cefr_level not null,
  mode text not null check (mode in ('speaking', 'shadowing', 'debate', 'writing')),
  -- Spanish-language instruction/topic shown to the learner.
  prompt text not null,
  -- Shadowing only: the target-language passage to read/repeat aloud.
  reference_text text,
  -- Shadowing only: short attribution label (e.g. "Daily Routine").
  source text,
  -- Suggested minimum effort for the mode: seconds for speaking/shadowing/
  -- debate, words for writing. Purely a UI hint — the actual XP/completion
  -- gate lives in the backend, not trusted from the client.
  target_seconds integer,
  target_words integer,
  order_index integer not null default 1
);

create index if not exists practice_prompts_lookup_idx
  on public.practice_prompts (language_code, level, mode);

alter table public.practice_prompts enable row level security;

drop policy if exists "practice_prompts_select_all" on public.practice_prompts;
create policy "practice_prompts_select_all" on public.practice_prompts
  for select to authenticated using (true);
