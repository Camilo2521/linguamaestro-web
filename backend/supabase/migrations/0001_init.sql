-- LinguaMaestro — initial schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`).
-- Reverse-engineered from application code since no prior migrations
-- existed in this repo. Safe to re-run from scratch: drops its own
-- objects first, so a partial/failed previous run won't conflict.

-- ── Reset (drop anything this script may have already created) ─────
-- Order matters: triggers/functions must go before the tables and
-- functions they depend on can be dropped cleanly.
drop trigger if exists on_auth_user_created on auth.users;

drop policy if exists "exam_videos_owner_read" on storage.objects;
drop policy if exists "exam_videos_owner_write" on storage.objects;

drop table if exists public.exam_attempts cascade;
drop table if exists public.activity_logs cascade;
drop table if exists public.srs_items cascade;
drop table if exists public.vocabulary_reference cascade;
drop table if exists public.lesson_progress cascade;
drop table if exists public.exercises cascade;
drop table if exists public.lessons cascade;
drop table if exists public.enrollments cascade;
drop table if exists public.users cascade;

drop function if exists public.handle_new_user();
drop function if exists public.increment_xp(uuid, integer);
drop function if exists public.update_streak(uuid);
drop function if exists public.set_updated_at();

drop type if exists exam_status;
drop type if exists exercise_type;
drop type if exists lesson_type;
drop type if exists cefr_level;
drop type if exists language_code;

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────
create type language_code as enum ('en','fr','pt','es','ja','zh');
create type cefr_level as enum ('A1','A2','B1','B2','C1','C2','NATIVE');
create type lesson_type as enum ('vocabulary','grammar','listening','speaking','reading','writing');
create type exercise_type as enum ('multiple_choice','fill_blank','flashcard','speaking','reorder');
create type exam_status as enum ('recording','processing','completed','failed');

-- ── users (extends auth.users) ──────────────────────────────────────
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  display_name text,
  native_language text,
  learning_goals text[] not null default '{}',
  avatar_url text,
  timezone text,
  daily_goal_minutes integer not null default 30,
  active_days integer[] not null default '{1,2,3,4,5}',
  onboarding_completed boolean not null default false,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  streak_freezes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ── enrollments ──────────────────────────────────────────────────────
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  language_code language_code not null,
  current_level cefr_level not null default 'A1',
  active boolean not null default true,
  total_study_hours numeric not null default 0,
  xp_total integer not null default 0,
  daily_goal_minutes integer not null default 30,
  started_at timestamptz not null default now(),
  diagnostic_completed boolean not null default false,
  exam_attempts_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index enrollments_user_id_idx on public.enrollments (user_id);

alter table public.enrollments enable row level security;

create policy "enrollments_select_own" on public.enrollments
  for select using (auth.uid() = user_id);
create policy "enrollments_insert_own" on public.enrollments
  for insert with check (auth.uid() = user_id);
create policy "enrollments_update_own" on public.enrollments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── lessons (reference data, readable by any signed-in user) ───────
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  language_code language_code not null,
  level cefr_level not null,
  lesson_type lesson_type not null,
  title text not null,
  description text,
  order_index integer not null,
  estimated_minutes integer not null default 10,
  exercise_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index lessons_language_level_idx on public.lessons (language_code, level, order_index);

alter table public.lessons enable row level security;

create policy "lessons_select_all" on public.lessons
  for select to authenticated using (true);

-- ── exercises ────────────────────────────────────────────────────────
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  type exercise_type not null,
  question text not null,
  options text[],
  correct_answer text not null,
  explanation text,
  order_index integer not null
);

create index exercises_lesson_id_idx on public.exercises (lesson_id, order_index);

alter table public.exercises enable row level security;

create policy "exercises_select_all" on public.exercises
  for select to authenticated using (true);

-- ── lesson_progress ──────────────────────────────────────────────────
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completed boolean not null default false,
  score numeric,
  time_spent_seconds integer not null default 0,
  completed_at timestamptz,
  unique (enrollment_id, lesson_id)
);

alter table public.lesson_progress enable row level security;

create policy "lesson_progress_select_own" on public.lesson_progress
  for select using (
    exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
  );
create policy "lesson_progress_insert_own" on public.lesson_progress
  for insert with check (
    exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
  );
create policy "lesson_progress_update_own" on public.lesson_progress
  for update using (
    exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
  );

-- ── vocabulary_reference ─────────────────────────────────────────────
create table public.vocabulary_reference (
  id uuid primary key default gen_random_uuid(),
  language_code language_code not null,
  word text not null,
  translation text not null,
  example_sentence text,
  audio_url text,
  image_url text,
  pronunciation text
);

alter table public.vocabulary_reference enable row level security;

create policy "vocabulary_reference_select_all" on public.vocabulary_reference
  for select to authenticated using (true);

-- ── srs_items ────────────────────────────────────────────────────────
create table public.srs_items (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary_reference (id) on delete cascade,
  ease_factor numeric not null default 2.5,
  interval_days integer not null default 1,
  repetitions integer not null default 0,
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  total_reviews integer not null default 0,
  unique (enrollment_id, vocabulary_id)
);

create index srs_items_due_idx on public.srs_items (enrollment_id, next_review_at);

alter table public.srs_items enable row level security;

create policy "srs_items_select_own" on public.srs_items
  for select using (
    exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
  );
create policy "srs_items_insert_own" on public.srs_items
  for insert with check (
    exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
  );
create policy "srs_items_update_own" on public.srs_items
  for update using (
    exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
  );

-- ── activity_logs ────────────────────────────────────────────────────
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  activity_type text not null check (activity_type in ('lesson','srs','speaking','listening','writing','exam')),
  duration_minutes integer not null,
  xp_earned integer not null default 0,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index activity_logs_user_created_idx on public.activity_logs (user_id, created_at);

alter table public.activity_logs enable row level security;

create policy "activity_logs_select_own" on public.activity_logs
  for select using (auth.uid() = user_id);
create policy "activity_logs_insert_own" on public.activity_logs
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
  );

-- ── exam_attempts ────────────────────────────────────────────────────
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  status exam_status not null default 'recording',
  video_url text,
  duration_seconds integer,
  transcript text,
  overall_score numeric,
  passed boolean,
  ai_feedback jsonb,
  submitted_at timestamptz,
  evaluated_at timestamptz,
  created_at timestamptz not null default now()
);

create index exam_attempts_user_id_idx on public.exam_attempts (user_id);

alter table public.exam_attempts enable row level security;

create policy "exam_attempts_select_own" on public.exam_attempts
  for select using (auth.uid() = user_id);
create policy "exam_attempts_insert_own" on public.exam_attempts
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
  );
create policy "exam_attempts_update_own" on public.exam_attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── updated_at bookkeeping ───────────────────────────────────────────
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger enrollments_set_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();

-- ── auth.users → public.users bootstrap ─────────────────────────────
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RPCs used by server actions ──────────────────────────────────────
create function public.increment_xp(p_enrollment_id uuid, p_xp integer) returns void
language sql security definer set search_path = public as $$
  update public.enrollments
  set xp_total = xp_total + p_xp,
      total_study_hours = total_study_hours + (p_xp::numeric / 100)
  where id = p_enrollment_id
    and user_id = auth.uid();
$$;

create function public.update_streak(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_last date;
  v_current integer;
  v_longest integer;
  v_freezes integer;
  v_today date := current_date;
  v_gap integer;
begin
  if p_user_id != auth.uid() then
    return;
  end if;

  select last_activity_date, current_streak, longest_streak, streak_freezes
    into v_last, v_current, v_longest, v_freezes
    from public.users where id = p_user_id;

  if v_last = v_today then
    return; -- already logged today, streak unchanged
  end if;

  v_gap := case when v_last is null then null else v_today - v_last end;

  if v_gap is null or v_gap = 1 then
    v_current := v_current + 1;
  elsif v_gap = 2 and v_freezes > 0 then
    v_current := v_current + 1;
    v_freezes := v_freezes - 1;
  else
    v_current := 1;
  end if;

  v_longest := greatest(v_longest, v_current);

  update public.users
  set current_streak = v_current,
      longest_streak = v_longest,
      streak_freezes = v_freezes,
      last_activity_date = v_today
  where id = p_user_id;
end;
$$;

-- ── Storage: exam recordings ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('exam-videos', 'exam-videos', false)
on conflict (id) do nothing;

create policy "exam_videos_owner_read" on storage.objects
  for select using (bucket_id = 'exam-videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "exam_videos_owner_write" on storage.objects
  for insert with check (bucket_id = 'exam-videos' and (storage.foldername(name))[1] = auth.uid()::text);
