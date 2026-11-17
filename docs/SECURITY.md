# Security

This document exists because several real, exploitable issues were found
and fixed while building this app, and the reasoning behind each fix is
worth keeping — it's the kind of thing that's easy to reintroduce by
accident in a future endpoint if the "why" isn't written down.

## The model

- The frontend holds **no Supabase credentials**. It only knows the
  backend's URL and the access token it got from login/register.
- The backend's default client (`getUserClient`) is scoped to the calling
  user's JWT, so Postgres RLS enforces ownership on almost every query
  automatically (see [DATABASE.md](./DATABASE.md)).
- The backend's `serviceClient` bypasses RLS entirely — any route that uses
  it is a place where the *application code*, not the database, is the only
  thing stopping one user from touching another's data, so it needs an
  explicit ownership check. No current route uses it (its one caller was
  the exam-evaluation pipeline, removed along with the rest of the oral-exam
  feature — see below), but the rule stands for the next one that does.

## Fixed: RPC functions had no ownership check

`increment_xp` and `update_streak` are `security definer` Postgres
functions, callable directly from a browser with just the anon key
(`supabase.rpc(...)`). The original versions took a raw target id
(`p_enrollment_id`, `p_user_id`) and trusted it — meaning any authenticated
user could call `increment_xp('someone-elses-enrollment-id', 999999)` and
inflate (or, with a negative value, deflate) a stranger's XP and study
hours, or force another account's streak to update. **Fix:** both functions
now check the target belongs to `auth.uid()` (a `WHERE user_id = auth.uid()`
clause for `increment_xp`, an early-return guard for `update_streak`) before
touching anything. See `backend/supabase/migrations/0002_security_fixes.sql`.

## Fixed: client-supplied XP/score had no bounds

`POST /lessons/:lessonId/complete` took a `score` argument and computed XP
as `round(score * 100)` — a tampered request with `score: 99999` would mint
arbitrary XP through `increment_xp`. `POST /activity` took `xpEarned`
directly with no relationship enforced to `durationMinutes` at all. **Fix:**
`score` is clamped to `[0,1]` before use, and `xpEarned` is clamped to
`durationMinutes × MAX_XP_PER_MINUTE` (`backend/src/utils/activity-limits.ts`)
regardless of what the client sends.

## Fixed: onboarding could be completed without an enrollment

`onboarding_completed = true` unlocks every protected page — but every
protected page also requires an active enrollment and redirects back to
`/onboarding/language` if there isn't one. Nothing enforced onboarding step
order, so reaching the final step without ever creating an enrollment (e.g.
a direct URL, browser back/forward) would set the flag with zero
enrollments — trapping the account in an infinite redirect loop with no UI
path out. **Fix:** `POST /onboarding/complete` checks for at least one
active enrollment first and returns `409 { code: "NO_ENROLLMENT" }` instead
of completing onboarding; the frontend sends the user back to the language
step on that response instead of retrying.

## Fixed: no `.gitignore`

The project wasn't a git repo yet, but `backend/.env` holds a live
service-role key — the one credential in this system that bypasses every
RLS policy above. Both `frontend/.gitignore` and `backend/.gitignore`
exclude `.env*` explicitly; check this is still true before this project's
first `git init`.

## Fixed: cross-tenant write via `activity_logs_insert_own`

The RLS policy only checked `auth.uid() = user_id` — it never verified the
supplied `enrollment_id` actually belonged to that same user (unlike
`lesson_progress`/`srs_items`, which already did this correctly via an
`exists (...)` check against `enrollments`). A user could log an activity
row carrying their own `user_id` but someone **else's** `enrollment_id`,
polluting another account's activity history and (at the time) feeding into
that account's exam eligibility. **Fix:**
`backend/supabase/migrations/0003_ownership_fixes.sql` adds the same
`exists (...)` ownership check this policy was missing. (This migration
originally fixed a matching gap in `exam_attempts_insert_own` too — moot now
that the `exam_attempts` table itself is gone, see
[ARCHITECTURE.md](./ARCHITECTURE.md).)

## Fixed: no async-error safety net on any route

Express 4 does not catch a rejected promise thrown from inside an
`async (req, res) => {...}` handler — an unexpected exception (a null-shape
surprise, a network error from postgrest-js that rejects instead of
resolving `{error}`, etc.) became an unhandled promise rejection, which
Node terminates the process on by default. No route file had any
`try`/`catch`. **Fix:** `app.ts` imports `express-async-errors` (patches
Express so these rejections reach the error middleware instead), and that
middleware also distinguishes malformed-JSON body-parser errors (400) from
a generic 500.

## Fixed: no rate limiting on auth routes

`/auth/login`, `/auth/register`, `/auth/forgot-password` had no throttling
beyond whatever Supabase's own project defaults provide — a gap for
credential stuffing and reset-email spam. **Fix:**
`backend/src/middleware/rateLimit.ts` adds `authLimiter` (20 req / 15 min)
on the three auth routes.

## Fixed: a few silently-swallowed Supabase errors

`increment_xp`/`activity_logs` insert errors in `lessons.routes.ts`, and
`update_streak` errors in `activity.routes.ts`, were fired-and-forgotten —
a real failure (e.g. the RPC's ownership guard silently matching 0 rows)
looked identical to success from the client's point of view. **Fix:** these
are now logged (`console.error`) so the failure is at least visible
operationally; the primary write's own success/failure still drives the
HTTP response, since these are secondary side effects of an already-committed
action.

## Fixed: a couple of validation gaps

- `activityType` on `POST /activity` was `z.string()` — any value not in the
  DB's `activity_logs` check constraint (`lesson|srs|speaking|listening|
  writing`) only failed at insert time, after the daily-limit query had
  already run. Now a `z.enum([...])` matching the constraint exactly.
- `enrollmentId` query params on `GET /lessons`, `GET /lessons/:lessonId`,
  and `GET /srs/due` were read as a raw string with no shape check — a
  malformed value produced a genuine Postgres "invalid input syntax for
  uuid" error reported back as a misleading 404. Now validated with
  `z.string().uuid()` first, giving a clean 400.
- `redirectTo` on `POST /auth/forgot-password` was embedded verbatim into
  the password-reset email with zero validation — an attacker-controlled
  URL there is a real phishing vector. Now only honored when its origin
  matches `CORS_ORIGIN` (the app's own frontend); anything else is dropped
  silently and Supabase's project-level default redirect is used instead.

## Open items (known, not yet fixed)

- **Dependency vulnerabilities in `frontend`**: `npm audit` reports
  remaining issues (Next.js DoS/SSRF advisories, PostCSS XSS) that only
  resolve by moving to Next.js 16, a major version bump out of the current
  `^15.3.0` range. Not applied automatically — evaluate compatibility before
  upgrading.
- **`timeSpentSeconds` on lesson completion is unbounded** — unlike `score`,
  it isn't clamped, so `activity_logs.duration_minutes` could be inflated by
  a tampered request. Lower severity than the XP issues above since it
  doesn't directly mint XP, but it does feed the daily-activity dashboard.
- **`dashboard.routes.ts`'s `GET /` does several unchecked Supabase calls**
  (`Promise.all` without inspecting each `error`) — a real query failure
  currently renders as zero/empty stats rather than a 500. Lower priority
  since it fails safe (empty, not wrong data), but worth tightening if this
  page ever needs to surface backend outages to users.
- If you add a new route using `serviceClient`, it needs its own explicit
  ownership check — there is no default protection once you're on that
  client. Search the codebase for `serviceClient` to see the existing
  pattern before adding another one.
