# Security

This document records the security model, the real issues that were found
and fixed (with the reasoning, so they aren't reintroduced), and the risks
that are known but still open. Last reviewed: 2026-11-16 (stabilization
audit).

## The model

### Authentication

- Supabase Auth owns credentials. Passwords are sent once to the backend
  (`/auth/register`, `/auth/login`) and forwarded to Supabase, which stores
  only a hash; the backend never stores or logs them.
- Registration requires ≥ 8 characters with an uppercase letter and a digit.
- Sessions are Supabase JWTs: a short-lived **access token** plus a
  **refresh token**. The frontend keeps both in `localStorage` and sends
  `Authorization: Bearer <access_token>`; on a `401` it calls
  `/auth/refresh` once and retries.
- `requireAuth` (`backend/src/middleware/auth.ts`) validates the token with
  `supabase.auth.getUser()` on **every** request (a network call to
  Supabase Auth), so an expired or invalid token is rejected immediately.
  Tokens are only accepted from the `Authorization` header.

### Authorization

- The backend's default client, `getUserClient(token)`, sends the caller's
  JWT to Postgres, so **RLS** decides which rows a request can see or change
  (see [DATABASE.md](./DATABASE.md#row-level-security)). Routes add
  `user_id` filters as a second layer.
- There are no roles and no administrative endpoints. Content tables are
  read-only to users; content is managed directly in Supabase.
- The backend never trusts identity data from the request body: `user_id`
  always comes from the validated token (`req.userId`). IDs sent by the
  client (`enrollmentId`, `lessonId`, `itemId`, `promptId`) are checked by
  RLS and/or explicit ownership queries.
- `serviceClient` (service-role key) bypasses RLS. **No route uses it.** Any
  future route that does must verify ownership itself in application code.

### Secrets and configuration

- The frontend holds **no Supabase credentials** — only
  `NEXT_PUBLIC_API_URL`, which is public by design.
- The backend reads `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY` from `backend/.env`. The service-role key
  bypasses every RLS policy: treat it as the most sensitive secret in the
  system.
- `.env` and `.env*.local` are git-ignored in both projects, and no secret
  has ever been committed (verified on the full history, 2026-11-16).

### Validation and transport hardening

- Every body/query is validated with Zod before use; client-supplied
  numbers that affect rewards are clamped or recomputed server-side.
- `helmet()` sets standard security headers on the API; the frontend sets
  `X-Content-Type-Options`, `X-Frame-Options: DENY` and `Referrer-Policy`
  (`next.config.ts`).
- CORS allows only the `CORS_ORIGIN` list plus any `https://*.vercel.app`
  origin (convenient for preview deploys, but it also admits any other
  Vercel-hosted site — tighten for production).
- `trust proxy` is set to 1 hop so rate limiting sees the real client IP
  behind a PaaS proxy.

## Fixed issues

### RPC functions had no ownership check

`increment_xp` and `update_streak` are `security definer` functions,
callable by any authenticated JWT. The original versions trusted the target
id they were given, so any user could change another user's XP or streak.
**Fix:** both check the target belongs to `auth.uid()` (`0002_security_fixes.sql`).

### Client-supplied XP/score had no bounds

`POST /lessons/:lessonId/complete` computed XP from a raw `score`, and
`POST /activity` accepted `xpEarned` as-is. **Fix:** `score` is clamped to
`[0,1]`; `xpEarned` is clamped to `durationMinutes × 20`
(`backend/src/utils/activity-limits.ts`).

### Practice grading trusted the client

**Fix (by design):** `POST /practice/:promptId/complete` grades
`multiple_choice`, `fill_blank` and `pronunciation` on the server against
the stored prompt; a client-reported "correct" flag is not accepted, and a
wrong answer earns 0 XP. The `writing` word-count floor is enforced
server-side from the prompt's `target_words`.

### Onboarding could be completed without an enrollment

That trapped the account in a redirect loop. **Fix:** `POST
/onboarding/complete` returns `409 { code: "NO_ENROLLMENT" }` when the user
has no active enrollment.

### Cross-tenant write via `activity_logs_insert_own`

The RLS policy didn't check that `enrollment_id` belonged to the caller.
**Fix:** `0003_ownership_fixes.sql` adds the same `exists (...)` ownership
check `lesson_progress`/`srs_items` already had.

### No async-error safety net

A rejected promise in an async Express 4 handler could crash the process.
**Fix:** `express-async-errors` plus a central error handler in `app.ts`
(400 for malformed JSON, generic 500 otherwise, details only in logs).

### No rate limiting on auth routes

**Fix:** `authLimiter` (20 req / 15 min per IP) on register, login and
forgot-password.

### Open redirect in password-reset emails

`redirectTo` was embedded verbatim in the reset email. **Fix:** only
honored when its origin equals `CORS_ORIGIN`.

### Silently swallowed side-effect errors; validation gaps

XP/streak/log failures are now logged; `activityType` and `enrollmentId`
query params are validated with Zod.

### CEFR level could be set or skipped at will

`PATCH /onboarding/diagnostic` accepted any level (including NATIVE) at any
time, and `POST /lessons/:id/complete` accepted any lesson id, decided XP
with a read-then-write check and advanced the level unconditionally.
**Fix (stabilization stage 3):** the placement quiz can only be applied once
per enrollment (atomic `WHERE diagnostic_completed = false`, else `409`);
lesson completion requires the lesson to belong to the enrollment's language
and current level (`409` otherwise), awards XP only to the request that
atomically flips the lesson to completed, and advances the level with a
compare-and-set on `current_level`. Covered by
`backend/tests/onboarding.routes.test.ts` and `lessons.routes.test.ts`.

### Known-vulnerable dependency versions

`npm audit fix` (no major upgrades) updated Next.js to 15.5.29 (critical
advisory) and the Express transitive dependencies `proxy-addr`,
`body-parser`, `qs`, plus `sharp` and `source-map-js`. Remaining items are in
open risk 4.

### Access token in URLs (removed with the exam feature)

The exam's SSE stream accepted the token as a `?token=` query parameter
(which ends up in logs and history). That fallback was removed together
with the exam; tokens are header-only.

### Env templates versioned (was open risk 15)

The root `.gitignore` now re-includes `.env.example`; `backend/.env.example`
and a new `frontend/.env.example` are versioned with placeholder values
only. Real `.env` / `.env.local` files remain ignored.

## Open risks

Ordered by priority. Severity reflects impact on data integrity or
confidentiality for this app. Numbers are stable IDs — resolved items move
to "Fixed issues" and their number is not reused (#1 was resolved in
stage 3, #15 during deployment prep).

| # | Severity | Risk | Where | Planned fix |
|---|---|---|---|---|
| 2 | Medium | **Lesson completion is self-reported.** Learn grades exercises client-side, so the API accepts any `score` (clamped to [0,1]) and a client can mark every lesson of its current level complete without doing it, which advances the level. (Language/level matching, once-only XP and race-safe level-up are fixed — see above.) | `lessons.routes.ts`, `LessonEngine.tsx` | Server-side grading of lesson exercises. |
| 3 | High | **RLS allows updating any column of own rows** (`enrollments.current_level`, `xp_total`; `users` streak fields; `srs_items` state), and `increment_xp` accepts any amount. Exploitable by anyone holding a user JWT **and** the anon key; neither the URL nor the anon key is shipped to the browser, so this is defense-in-depth. | RLS policies, `increment_xp` | Column-level grants or narrower update policies; restrict `increment_xp` execution. |
| 4 | Medium | **Remaining dependency advisories** after `npm audit fix` (2026-11-16, Next 15.5.29). `zod` < 4.6.6 (high: memory exhaustion validating oversized constrained collections) in both projects — fix only in zod v4. Frontend: the `postcss@8.4.31` bundled inside `next` (high; affects processing untrusted CSS, which this app doesn't do) — fix only in Next 16. | `package.json` | Bound array/string sizes in Zod schemas (e.g. `/srs/seed` `vocabularyIds`); plan zod v4 / Next 16 upgrades. |
| 5 | Medium | **Logout doesn't revoke the session.** `auth.signOut()` on a client with no stored session never calls Supabase, so the refresh token stays valid until it expires. | `auth.routes.ts` | Call `auth.admin.signOut(accessToken)` (revokes refresh tokens). |
| 6 | Medium | **Answers are sent to the client.** `GET /practice` and `GET /lessons/:id` return `correct_answer` (and Learn grades client-side). | `practice.routes.ts`, `lessons.routes.ts` | Omit answers from Practice listings; consider server grading in Learn. |
| 7 | Medium | **Client-reported effort.** Practice XP depends on client `durationSeconds` (no upper bound beyond the 360-min daily cap); `timeSpentSeconds` on lessons is unbounded; `wordCount` is client-reported. | practice/lessons routes | Bound values; derive from server timestamps where possible. |
| 8 | Medium | **Tokens in `localStorage`** are readable by any script on the page (XSS → session theft). No Content-Security-Policy is set. | `frontend/lib/api/client.ts`, `next.config.ts` | Add a CSP; consider httpOnly-cookie refresh tokens. |
| 9 | Medium | **Rate limiting only on 3 auth routes.** `/auth/refresh` and all data routes are unthrottled (each request also triggers a Supabase Auth call). | `app.ts` | Global per-IP/per-user limiter. |
| 10 | Medium | **Database error messages are returned to clients** (`error.message` on 400s) — leaks schema details; register reveals whether an email already has an account. | routes | Map to generic messages; log details. |
| 11 | Low | `forgot-password` compares `redirectTo` to the whole `CORS_ORIGIN` string, so it never matches when several origins are configured (fails closed). | `auth.routes.ts` | Compare against the parsed origin list. |
| 12 | Low | The backend refuses to start without `SUPABASE_SERVICE_ROLE_KEY` although nothing uses it; there is no startup validation of env vars. | `lib/supabase.ts` | Create the service client lazily / drop it; validate env with Zod at boot. |
| 13 | Low | `*.vercel.app` CORS wildcard admits any Vercel-hosted site. | `app.ts` | Restrict to the project's own preview pattern in production. |
| 14 | Low | Day boundaries (daily cap, streak, dashboard dates) use UTC, not the user's time zone. | activity utils, `update_streak` | Use `users.timezone`. |

## Procedures

### Before adding or changing an endpoint

1. Put it behind `requireAuth` unless it is genuinely public.
2. Validate every input with Zod, including bounds on numbers, strings and
   arrays.
3. Use `getUserClient(req.accessToken!)`; take the user id from
   `req.userId`, never from the body.
4. Recompute or clamp anything that affects XP, level, streak or grading on
   the server.
5. Don't return raw database errors or reference answers to the client.
6. Add tests for: no token (401), another user's resource (404/400),
   invalid input (400).

### If a secret leaks

- **Service-role key or anon key**: rotate the JWT secret / API keys in the
  Supabase dashboard (Project Settings → API), update `backend/.env` in every
  environment, redeploy the backend. Rotating the JWT secret also signs out
  every user.
- **A user's tokens**: revoke that user's sessions from the Supabase
  dashboard (Authentication → Users).
- Check Supabase logs for activity during the exposure window.

### Database changes

- Never run `0001_init.sql` on a database with data (it drops all tables).
- Take a backup (Supabase dashboard backups or `pg_dump`) before applying
  any migration to production.
- New migrations must be idempotent and keep RLS enabled on every table.
