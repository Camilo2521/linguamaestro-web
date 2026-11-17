# Database

PostgreSQL via Supabase. Schema lives in
[`backend/supabase/migrations/`](../backend/supabase/migrations) — run these
in the Supabase SQL Editor, in order, on a fresh project:

1. `0001_init.sql` — all tables, enums, RLS policies, the `handle_new_user`
   trigger, and the `increment_xp`/`update_streak` RPCs.
2. `0002_security_fixes.sql` — patches `increment_xp`/`update_streak` to
   check the caller owns the row they're targeting (idempotent, safe to
   run again). Already folded into `0001_init.sql` for fresh installs; this
   file exists to patch a project that already ran the old `0001`.
3. `0003_ownership_fixes.sql` — patches `activity_logs_insert_own` to also
   verify the supplied `enrollment_id` belongs to the caller (idempotent).
   Also already folded into `0001_init.sql` for fresh installs — this
   closed a cross-tenant write gap; see [SECURITY.md](./SECURITY.md) for
   the surviving (non-exam) parts of that fix.
4. `0004_vocabulary_level.sql` — adds a `level cefr_level not null` column to
   `vocabulary_reference` (idempotent). Already folded into `0001_init.sql`
   for fresh installs. Needed so a beginner's SRS deck can be seeded with
   only A1 words instead of every word for the language at once — see the
   note below.
5. `0005_streak_respects_active_days.sql` — patches `update_streak` so a
   calendar gap that falls entirely on the days a user marked as "rest days"
   (`users.active_days`, chosen during onboarding) no longer breaks their
   streak, and corrects the `active_days` column default from `{1,2,3,4,5}`
   to `{0,1,2,3,4}` (idempotent). Already folded into `0001_init.sql` for
   fresh installs — see "How the streak respects active days" below.
6. `0006_practice_prompts.sql` — adds the `practice_prompts` reference
   table (idempotent). Already folded into `0001_init.sql` for fresh
   installs. Backs the Practice section's 4 modes (speaking, shadowing,
   debate, writing) across all 6 languages × 7 levels — see "Why Practice
   has its own completion route instead of reusing `/activity`" below.
7. `0007_vocabulary_lesson_scoping.sql` — adds a nullable `lesson_id` column
   to `vocabulary_reference` (idempotent). Already folded into `0001_init.sql`
   for fresh installs. Lets SRS seeding tie a word to the specific lesson
   that introduces it instead of dumping a whole level's vocabulary into the
   deck the moment any one lesson at that level is completed — see "How SRS
   items get created" below.
8. `0008_remove_exam_certification.sql` — drops the `exam_attempts` table,
   the `exam_status` enum, `enrollments.exam_attempts_count`, the
   `exam-videos` storage bucket, and `'exam'` from
   `activity_logs.activity_type` (idempotent). Already folded into
   `0001_init.sql` for fresh installs. The oral-exam/certification feature
   was removed; the CEFR level system (A1-C2, NATIVE) stays as the
   progression scheme for lessons/vocabulary/practice.

All eight files are safe to re-run: `0001_init.sql` drops its own objects
before recreating them.

## Tables

| Table | Purpose | Key columns |
|---|---|---|
| `users` | App profile, extends `auth.users` 1:1 | `id` (= `auth.users.id`), `onboarding_completed`, `current_streak`, `longest_streak`, `daily_goal_minutes`, `active_days` |
| `enrollments` | One row per language a user is learning | `user_id`, `language_code`, `current_level`, `active`, `total_study_hours`, `xp_total` — **a user can have more than one active enrollment**, don't `.single()` this query |
| `lessons` | Reference content, not user-owned | `language_code`, `level`, `lesson_type`, `order_index` |
| `exercises` | Belongs to a lesson | `lesson_id`, `type` (`multiple_choice\|fill_blank\|flashcard\|speaking\|reorder`), `correct_answer` |
| `lesson_progress` | Per-enrollment completion of a lesson | unique on `(enrollment_id, lesson_id)` |
| `vocabulary_reference` | Reference vocabulary for SRS, scoped by level | `language_code`, `level`, `word`, `translation`, `example_sentence`, `lesson_id` (nullable — see below) |
| `srs_items` | Per-enrollment SM-2 scheduling state for one vocabulary item | unique on `(enrollment_id, vocabulary_id)`, `ease_factor`, `interval_days`, `next_review_at` |
| `activity_logs` | Every logged study session | `user_id`, `enrollment_id`, `activity_type`, `duration_minutes`, `xp_earned` |
| `practice_prompts` | Reference content for the Practice section, scoped by language + level + mode | `language_code`, `level`, `mode` (`speaking\|shadowing\|debate\|writing`), `prompt`, `reference_text` (shadowing only), `target_seconds`/`target_words` |

`users.id`, `enrollments.user_id`, and every other user-owned table ultimately
trace back to `auth.users.id` — a row is auto-created in `public.users` by
the `handle_new_user` trigger the moment someone signs up (no application
code inserts it directly).

## Row Level Security

Every table has RLS enabled. The pattern is consistent:

- **User-owned tables** (`users`, `enrollments`, `activity_logs`):
  `using (auth.uid() = user_id)` (or `= id` for `users`) on
  select/insert/update.
- **Tables owned indirectly through an enrollment** (`lesson_progress`,
  `srs_items`): `using (exists (select 1 from enrollments e where e.id =
  enrollment_id and e.user_id = auth.uid()))`.
- **Reference tables** (`lessons`, `exercises`, `vocabulary_reference`,
  `practice_prompts`): `for select to authenticated using (true)` —
  readable by any signed-in user, no insert/update/delete policy for
  regular users at all.
- No table has a `delete` policy — deletion isn't a supported operation
  today; it fails closed rather than being silently allowed.

Because the backend's default Supabase client (`getUserClient`) carries the
real user's JWT, these policies are the primary enforcement layer — even a
route that forgot a `.eq('user_id', ...)` filter still can't leak another
user's rows. `serviceClient` (service-role, bypasses RLS entirely) is still
exported from `lib/supabase.ts`, but no route currently uses it — its only
caller was the exam-evaluation pipeline, removed along with the rest of the
oral-exam feature. Any future route that reaches for it must do its own
ownership check in application code, the same way the exam routes used to
— see [SECURITY.md](./SECURITY.md).

## How SRS items get created

Nothing seeds `srs_items` on its own — there's no cron job or trigger. The
only path that populates a learner's spaced-repetition deck is
`POST /lessons/:lessonId/complete` (`backend/src/routes/lessons.routes.ts`):
after marking the lesson complete, it looks up which `vocabulary_reference`
rows to seed and upserts one `srs_items` row per word for that enrollment
(`onConflict: 'enrollment_id,vocabulary_id', ignoreDuplicates: true`, so
repeat completions of the same lesson don't reset progress or duplicate
rows). This is why `vocabulary_reference` needed a `level` column
(`0004_vocabulary_level.sql`) — without it, completing an A1 lesson would
have seeded a beginner's deck with every word for that language at every
level, including NATIVE-level vocabulary, on day one.

Which words get pulled depends on `vocabulary_reference.lesson_id`
(`0007_vocabulary_lesson_scoping.sql`):

- If any words are tied to *this* lesson (`lesson_id = lessonId`), only
  those are seeded. This is the intended path for content where each
  lesson introduces its own handful of words — completing lesson 3 of 8
  seeds only lesson 3's words, not the other 7 lessons' worth.
- Otherwise (no row has this lesson's id — true for all content generated
  before this column existed), it falls back to the old behavior: every
  `vocabulary_reference` row for that `language_code`+`level` with a
  **null** `lesson_id`. This is a real fallback, not just "no words found"
  — a level can have both lesson-scoped rows (skipped by this query) and
  unscoped legacy rows (matched by it) at the same time.

Skipping this distinction — e.g. seeding on level match alone regardless of
`lesson_id` — would dump every lesson-scoped word for the whole level into
the deck the first time any one lesson at that level is completed, which is
exactly the front-loading problem this column exists to avoid.

## Why Practice has its own completion route instead of reusing `/activity`

The old Practice page was a single open-ended timer bound to `POST
/activity`, which enforces a 15-minute minimum session — sized for
lesson/study-time tracking, not a 2-5 minute speaking or writing prompt.
The page's own UI told users "2 minutes is enough, you can finish now,"
but finishing at 2 minutes always failed against that 15-minute floor,
with no error handling anywhere in the call chain to catch it — the
session UI just never reset. `POST /practice/:promptId/complete`
(`backend/src/routes/practice.routes.ts`) fixes this by being a discrete
completion, the same shape as `POST /lessons/:lessonId/complete`: it logs
directly to `activity_logs` with a floor sized for a single prompt (20
seconds for oral modes, half the prompt's `target_words` for writing)
instead of inheriting `/activity`'s session-length floor. It still shares
the 360-minute daily cap and `update_streak` call with `/activity` (via
the `getTodayTotalMinutes` helper in `activity-limits.ts`), so a user
can't use Practice to bypass the daily limit.

## How the streak respects active days

`users.active_days` (0=Mon..6=Sun) is chosen once during onboarding
("¿qué días planeas estudiar?") but used to be write-only — nothing ever
read it back, so `update_streak` broke the streak over *any* calendar gap,
including days the user had explicitly marked as rest days. Someone who
picked "Mon-Fri" still lost their streak every weekend.

`update_streak` now counts, as a potential streak-breaker, only the days
strictly between `last_activity_date` and today that are in the user's own
`active_days` (via `generate_series` + `extract(isodow from day) - 1`). A
gap that falls entirely on non-active days is free. The streak-freeze rule
carries over unchanged, just re-scoped to active days: exactly one missed
*active* day still consumes a freeze instead of resetting the streak; two
or more resets it. A null/empty `active_days` falls back to the old
pure-calendar behavior (every day counts), so accounts from before this
migration ran don't change behavior until they have a real schedule.

## RPC functions

- **`increment_xp(p_enrollment_id uuid, p_xp integer)`** — adds XP and a
  proportional amount of `total_study_hours` to an enrollment. `security
  definer`, but scoped with `and user_id = auth.uid()` in the `UPDATE`'s
  `WHERE` clause, so calling it with someone else's enrollment id is a
  silent no-op rather than a cross-account write.
- **`update_streak(p_user_id uuid)`** — advances or resets `current_streak`
  based on the gap since `last_activity_date` *among the user's active
  days* (see above), consuming a `streak_freeze` to bridge a single missed
  active day if one is available. Also `security definer`; the first
  statement in the function body is `if p_user_id != auth.uid() then
  return; end if;` for the same reason.

Both are callable directly from a Supabase client with just the anon key
(any authenticated user can call `supabase.rpc(...)` from a browser) — the
ownership check inside the function body is what makes that safe, not
anything at the call site.

## Storage

No buckets today. The only one that ever existed, `exam-videos`, was
dropped by `0008_remove_exam_certification.sql` along with the rest of the
oral-exam feature.

## Entity-relationship notes

Every embedded/joined query the backend runs (`lessons(*, exercises(*))`,
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
- **`daily_goal_minutes` is duplicated on `users` and `enrollments`** — both
  columns exist, both default to `30`. Only `users.daily_goal_minutes` is
  ever written after account creation (`POST /onboarding/complete` and
  `PATCH /dashboard/settings/daily-goal` both target `users`, never
  `enrollments`), so `enrollments.daily_goal_minutes` is stuck at its
  schema default forever — it's a dead column. The frontend used to read
  the `enrollments` copy for the dashboard's daily-progress goal, so
  changing your goal in Settings silently had no effect there; fixed to
  read `users.daily_goal_minutes` instead (see
  [DailyProgress.tsx](../frontend/components/dashboard/DailyProgress.tsx)).
  The `enrollments` column itself hasn't been dropped — no code depends on
  its value, but it's worth knowing before you reach for it.
