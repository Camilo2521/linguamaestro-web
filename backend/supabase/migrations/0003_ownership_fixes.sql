-- LinguaMaestro — ownership patch
-- Run this in the Supabase SQL Editor on top of 0001_init.sql + 0002.
-- Idempotent: safe to re-run.
--
-- Fixes a critical cross-tenant hole: exam_attempts_insert_own and
-- activity_logs_insert_own only checked `auth.uid() = user_id` — they never
-- verified the supplied `enrollment_id` actually belongs to that same user
-- (unlike lesson_progress/srs_items, which already did this correctly via
-- an `exists (...)` check against `enrollments`). A user could create an
-- exam_attempts row with their own user_id but someone ELSE's enrollment_id;
-- the exam-evaluation route later advances `enrollments.current_level` for
-- that enrollment_id via the service-role client (which bypasses RLS), so
-- this let one user's exam submission silently change another account's
-- CEFR level.

drop policy if exists "exam_attempts_insert_own" on public.exam_attempts;
create policy "exam_attempts_insert_own" on public.exam_attempts
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
  );

drop policy if exists "activity_logs_insert_own" on public.activity_logs;
create policy "activity_logs_insert_own" on public.activity_logs
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.enrollments e where e.id = enrollment_id and e.user_id = auth.uid())
  );
