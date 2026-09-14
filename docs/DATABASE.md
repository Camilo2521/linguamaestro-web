# Database

PostgreSQL via Supabase. Schema lives in
[`backend/supabase/migrations/`](../backend/supabase/migrations) — run these
in the Supabase SQL Editor, in order, on a fresh project:

1. `0001_init.sql` — all tables, enums, RLS policies, the `handle_new_user`
   trigger, the `increment_xp`/`update_streak` RPCs, and the `exam-videos`
   storage bucket.
2. `0002_security_fixes.sql` — patches `increment_xp`/`update_streak` to
   check the caller owns the row they're targeting (idempotent, safe to
   run again). Already folded into `0001_init.sql` for fresh installs; this
   file exists to patch a project that already ran the old `0001`.
3. `0003_ownership_fixes.sql` — patches `exam_attempts_insert_own` and
   `activity_logs_insert_own` to also verify the supplied `enrollment_id`
   belongs to the caller (idempotent). Also already folded into
   `0001_init.sql` for fresh installs — see [SECURITY.md](./SECURITY.md#fixed-cross-tenant-enrollment-hijack-via-post-examattempts)
   for why this mattered.

All three files are safe to re-run: `0001_init.sql` drops its own objects before
recreating them.

## Tables

| Table | Purpose | Key columns |
|---|---|---|
| `users` | App profile, extends `auth.users` 1:1 | `id` (= `auth.users.id`), `onboarding_completed`, `current_streak`, `longest_streak`, `daily_goal_minutes`, `active_days` |
| `enrollments` | One row per language a user is learning | `user_id`, `language_code`, `current_level`, `active`, `total_study_hours`, `xp_total` — **a user can have more than one active enrollment**, don't `.single()` this query |
| `lessons` | Reference content, not user-owned | `language_code`, `level`, `lesson_type`, `order_index` |
| `exercises` | Belongs to a lesson | `lesson_id`, `type` (`multiple_choice\|fill_blank\|flashcard\|speaking\|reorder`), `correct_answer` |
| `lesson_progress` | Per-enrollment completion of a lesson | unique on `(enrollment_id, lesson_id)` |
| `vocabulary_reference` | Reference vocabulary for SRS | `word`, `translation`, `example_sentence` |
| `srs_items` | Per-enrollment SM-2 scheduling state for one vocabulary item | unique on `(enrollment_id, vocabulary_id)`, `ease_factor`, `interval_days`, `next_review_at` |
| `activity_logs` | Every logged study session | `user_id`, `enrollment_id`, `activity_type`, `duration_minutes`, `xp_earned` |
| `exam_attempts` | One oral exam attempt | `user_id`, `enrollment_id`, `status` (`recording\|processing\|completed\|failed`), `video_url`, `overall_score`, `passed`, `ai_feedback` (jsonb) |

`users.id`, `enrollments.user_id`, and every other user-owned table ultimately
trace back to `auth.users.id` — a row is auto-created in `public.users` by
the `handle_new_user` trigger the moment someone signs up (no application
code inserts it directly).

## Row Level Security

Every table has RLS enabled. The pattern is consistent:

- **User-owned tables** (`users`, `enrollments`, `activity_logs`,
  `exam_attempts`): `using (auth.uid() = user_id)` (or `= id` for `users`)
  on select/insert/update.
- **Tables owned indirectly through an enrollment** (`lesson_progress`,
  `srs_items`): `using (exists (select 1 from enrollments e where e.id =
  enrollment_id and e.user_id = auth.uid()))`.
- **Reference tables** (`lessons`, `exercises`, `vocabulary_reference`):
  `for select to authenticated using (true)` — readable by any signed-in
  user, no insert/update/delete policy for regular users at all.
- No table has a `delete` policy — deletion isn't a supported operation
  today; it fails closed rather than being silently allowed.

Because the backend's default Supabase client (`getUserClient`) carries the
real user's JWT, these policies are the primary enforcement layer — even a
route that forgot a `.eq('user_id', ...)` filter still can't leak another
user's rows. The exceptions are backend routes using `serviceClient` (the
exam evaluation pipeline), which bypass RLS and must check ownership in
application code — see [SECURITY.md](./SECURITY.md).

## RPC functions

- **`increment_xp(p_enrollment_id uuid, p_xp integer)`** — adds XP and a
  proportional amount of `total_study_hours` to an enrollment. `security
  definer`, but scoped with `and user_id = auth.uid()` in the `UPDATE`'s
  `WHERE` clause, so calling it with someone else's enrollment id is a
  silent no-op rather than a cross-account write.
- **`update_streak(p_user_id uuid)`** — advances or resets `current_streak`
  based on the gap since `last_activity_date`, consuming a `streak_freeze`
  to bridge a single missed day if one is available. Also `security
  definer`; the first statement in the function body is `if p_user_id !=
  auth.uid() then return; end if;` for the same reason.

Both are callable directly from a Supabase client with just the anon key
(any authenticated user can call `supabase.rpc(...)` from a browser) — the
ownership check inside the function body is what makes that safe, not
anything at the call site.

## Storage

One bucket: **`exam-videos`** (private). Objects are keyed
`<user_id>/<attempt_id>.<ext>`; storage policies restrict both read and
write to the path's first segment matching `auth.uid()`. The backend's
`serviceClient` bypasses this to create signed URLs for the transcription
step — see the exam evaluation flow in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Entity-relationship notes

Every embedded/joined query the backend runs (`lessons(*, exercises(*))`,
`enrollments(*, exam_attempts(...))`, `exam_attempts(*, enrollments(...))`,
`srs_items(*, vocabulary_reference(...))`) targets a table pair with exactly
one foreign key between them, so none of them need (or use) PostgREST's
explicit `!constraint_name` disambiguation hint. If a future migration adds
a second FK between any of these pairs, those queries will start failing
with an ambiguous-relationship error from PostgREST — worth remembering
before adding one.

Two things worth knowing about, not yet changed:

- **Reference-content deletes cascade into user-owned progress.**
  `lesson_progress.lesson_id`, `srs_items.lesson_id`, and
  `srs_items.vocabulary_id` all `on delete cascade` from `lessons` /
  `vocabulary_reference`. That's the right behavior for `exercises` (lesson-
  owned content), but for these three it means deleting a lesson or
  vocabulary row — e.g. to fix or retire it — silently erases every user's
  completion history, XP record, and SRS scheduling state tied to it. Not
  reachable through the API today (no table has a `delete` policy, so this
  can only happen via direct SQL/dashboard access), but worth treating as a
  "restrict, don't cascade" candidate if content ever needs editing in place
  rather than left immutable.
- **`enrollments.exam_attempts_count` is dead.** It's read (`GET
  /exam/eligibility`'s query includes it) but never actually passed into
  `computeEligibility` (which only uses `currentLevel`/`hoursStudied`/
  `startedAt`/`lastAttemptDate`), and nothing anywhere increments it — it
  stays at its default of `0` forever. Harmless (nothing depends on its
  value), but if you're about to use it for something, know that it isn't
  currently kept in sync with reality.
