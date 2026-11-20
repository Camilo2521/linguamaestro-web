# Database

PostgreSQL via Supabase. Schema lives in
[`backend/supabase/migrations/`](../backend/supabase/migrations). There is
no migration runner: files are applied by hand in the Supabase SQL Editor
(or `supabase db push`), and nothing records which ones have run.

## Migrations

> ⚠️ **`0001_init.sql` is destructive.** It starts by dropping every
> LinguaMaestro table (`drop table ... cascade`), type, function and the
> `on_auth_user_created` trigger, then recreates them. Running it against a
> database with real users **deletes all their data**. Only run it on an
> empty project.

`0001_init.sql` has been kept up to date with the full current schema, so
there are two paths:

- **Fresh project:** run `0001_init.sql` only. Running 0002–0009 afterwards
  is harmless (all are idempotent) but unnecessary.
- **Existing project** (created with an older `0001`): run, in order, each
  file from 0002 to 0009 that hasn't been applied yet. Never re-run 0001.
  Back up first (see the production notes in [SECURITY.md](./SECURITY.md)).

1. `0001_init.sql` — all tables, enums, RLS policies, the `handle_new_user`
   trigger, and the `increment_xp`/`update_streak` RPCs. Reflects the
   complete current schema (0002–0009 included).
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
   installs. Backs the Practice section's original 4 modes (speaking,
   shadowing, debate, writing — extended to 7 by 0009) across all 6
   languages × 7 levels — see "Why Practice
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
   progression scheme for lessons/vocabulary/practice. Deletes any existing
   `activity_logs` rows with `activity_type = 'exam'` before tightening the
   check constraint. If the `exam-videos` bucket still holds files, empty it
   from the Storage dashboard first or the last statement fails.
9. `0009_practice_more_modes.sql` — adds `options text[]` and
   `correct_answer text` to `practice_prompts` and widens its `mode` check to
   the seven modes (adds `multiple_choice`, `fill_blank`, `pronunciation`).
   Idempotent; already folded into `0001_init.sql`.

0002–0009 are idempotent (safe to re-run). 0004 sets
`vocabulary_reference.level` to `NOT NULL` and therefore assumes that table
is empty when it runs; 0008 is the only one that deletes data (`'exam'`
activity rows) besides 0001.

The repository contains **no seed data** — lessons, exercises,
vocabulary and practice prompts must be loaded separately.

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
| `practice_prompts` | Reference content for the Practice section, scoped by language + level + mode | `language_code`, `level`, `mode` (`speaking\|shadowing\|debate\|writing\|multiple_choice\|fill_blank\|pronunciation`), `prompt` (Spanish instruction), `reference_text` (shadowing/pronunciation passage), `options` (multiple choice), `correct_answer` (multiple choice / fill blank), `target_seconds`/`target_words` (UI hints; `target_words` also sets the writing gate), `order_index` |

Enums: `language_code` (`en, fr, pt, es, ja, zh`), `cefr_level` (`A1, A2,
B1, B2, C1, C2, NATIVE`), `lesson_type` (`vocabulary, grammar, listening,
speaking, reading, writing`), `exercise_type` (`multiple_choice, fill_blank,
flashcard, speaking, reorder`).

## Relationships, constraints and indexes

```
auth.users 1─1 users 1─* enrollments 1─* lesson_progress *─1 lessons 1─* exercises
                    │              ├──* srs_items ─────────*─1 vocabulary_reference *─0..1 lessons
                    │              └──* activity_logs
                    └──* activity_logs
practice_prompts (standalone reference table)
```

Foreign keys and delete behavior:

| Column | References | On delete |
|---|---|---|
| `users.id` | `auth.users.id` | cascade |
| `enrollments.user_id` | `users.id` | cascade |
| `exercises.lesson_id` | `lessons.id` | cascade |
| `lesson_progress.enrollment_id` / `.lesson_id` | `enrollments.id` / `lessons.id` | cascade / cascade |
| `vocabulary_reference.lesson_id` (nullable) | `lessons.id` | set null |
| `srs_items.enrollment_id` / `.lesson_id` / `.vocabulary_id` | `enrollments` / `lessons` / `vocabulary_reference` | cascade (all three) |
| `activity_logs.user_id` / `.enrollment_id` | `users.id` / `enrollments.id` | cascade / cascade |

Deleting a user in Supabase Auth therefore removes all of that user's data.

Unique and check constraints:

- `lesson_progress (enrollment_id, lesson_id)` unique — one progress row per
  lesson per enrollment (the completion route upserts on it).
- `srs_items (enrollment_id, vocabulary_id)` unique — a word appears once in
  a learner's deck (seeding ignores duplicates).
- `activity_logs.activity_type` in `lesson, srs, speaking, listening, writing`.
- `practice_prompts.mode` in the seven Practice modes.
- **Not** constrained today: one enrollment per user + language, value
  ranges (`score`, `ease_factor`, `xp_total`, `duration_minutes`), and
  `active_days` values.

Indexes: `enrollments (user_id)`, `lessons (language_code, level,
order_index)`, `exercises (lesson_id, order_index)`,
`vocabulary_reference (language_code, level)`, `vocabulary_reference
(lesson_id)`, `srs_items (enrollment_id, next_review_at)`,
`activity_logs (user_id, created_at)`, `practice_prompts (language_code,
level, mode)`, plus the indexes behind primary keys and unique constraints.

Triggers: `users` and `enrollments` maintain `updated_at`;
`on_auth_user_created` (on `auth.users`) creates the `public.users` row.

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
- Update policies are **row-level only**: a user may update any column of
  their own `users`, `enrollments`, `lesson_progress` and `srs_items` rows
  (including `current_level`, `xp_total`, streak counters, SRS state).
  Today only the backend talks to Supabase, but with a user's JWT and the
  anon key these columns could be written directly. Tracked in
  [SECURITY.md](./SECURITY.md#open-risks).

Because the backend's default Supabase client (`getUserClient`) carries the
real user's JWT, these policies are the primary enforcement layer — even a
route that forgot a `.eq('user_id', ...)` filter still can't leak another
user's rows. `getServiceClient()` (service-role, bypasses RLS entirely) is still
exported from `lib/supabase.ts`, but no route currently uses it — its only
caller was the exam-evaluation pipeline, removed along with the rest of the
oral-exam feature. Any future route that reaches for it must do its own
ownership check in application code — see [SECURITY.md](./SECURITY.md).

## How progress is tracked

| What | Where | Written by |
|---|---|---|
| Current CEFR level | `enrollments.current_level` | `POST /onboarding/enrollment` (A1), `PATCH /onboarding/diagnostic` (placement), `POST /lessons/:id/complete` (auto-advance) |
| Lesson completion | `lesson_progress` (`completed`, `score`, `time_spent_seconds`, `completed_at`) | `POST /lessons/:id/complete` |
| XP and study hours | `enrollments.xp_total`, `enrollments.total_study_hours` | `increment_xp` RPC — lessons only (practice XP is logged in `activity_logs` but not added here) |
| Activity history, daily minutes | `activity_logs` | lessons, practice, `POST /activity` |
| Streak | `users.current_streak`, `longest_streak`, `last_activity_date`, `streak_freezes` | `update_streak` RPC — practice and `POST /activity` (not lesson completion) |
| Vocabulary review state | `srs_items` | lesson completion (seeding), `POST /srs/:id/review` |

## Spaced repetition (SM-2) storage

Each `srs_items` row holds the SM-2 state for one word in one enrollment:
`ease_factor` (starts 2.5, floor 1.3), `interval_days` (starts 1),
`repetitions` (consecutive successful reviews, starts 0), `next_review_at`
(due date; new items are due immediately), `last_reviewed_at` and
`total_reviews`. `GET /srs/due` reads items with `next_review_at <= now()`
using the `(enrollment_id, next_review_at)` index; `POST /srs/:id/review`
computes the new state in `backend/src/utils/srs-schedule.ts` and writes it
back (formula in [API.md](./API.md#srs-spaced-repetition--srs-all-)).

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
