-- LinguaMaestro — remove the oral-exam / CEFR certification feature
-- Run this in the Supabase SQL Editor on top of 0001-0007.
-- Idempotent: safe to re-run.
--
-- The app keeps the CEFR level system (A1-C2, NATIVE) as the progression
-- scheme for lessons/vocabulary/practice — only the formal certification
-- exam (oral recording, Whisper transcription, Claude grading, pass/fail)
-- is being removed, along with every table/column/bucket that existed
-- solely to support it.

-- `activity_logs.activity_type` historically allowed 'exam' as a value —
-- tightening the check constraint validates every existing row, so any
-- leftover exam-activity log entries have to go first or this migration
-- fails on a project with real data.
delete from public.activity_logs where activity_type = 'exam';

alter table public.activity_logs
  drop constraint if exists activity_logs_activity_type_check;
alter table public.activity_logs
  add constraint activity_logs_activity_type_check
  check (activity_type in ('lesson', 'srs', 'speaking', 'listening', 'writing'));

alter table public.enrollments
  drop column if exists exam_attempts_count;

drop policy if exists "exam_attempts_select_own" on public.exam_attempts;
drop policy if exists "exam_attempts_insert_own" on public.exam_attempts;
drop policy if exists "exam_attempts_update_own" on public.exam_attempts;
drop table if exists public.exam_attempts cascade;

drop type if exists exam_status;

-- Storage: the bucket row and its policies are dropped here. If any exam
-- videos were ever actually uploaded, Postgres won't let the bucket itself
-- be deleted while it still holds objects — clear those from the Storage
-- tab in the Supabase dashboard first (or via the Storage API) if this
-- last statement errors.
drop policy if exists "exam_videos_owner_read" on storage.objects;
drop policy if exists "exam_videos_owner_write" on storage.objects;
delete from storage.buckets where id = 'exam-videos';
