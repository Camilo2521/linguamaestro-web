# API Reference

Base URL: `http://localhost:4000` in development (`NEXT_PUBLIC_API_URL` on
the frontend). All responses are JSON with a `{ success: boolean, ... }`
envelope; errors are `{ success: false, error: string, code?: string }`.

Routes marked **🔒** require `Authorization: Bearer <access_token>`. The
access token is the one returned by `/auth/login` or `/auth/register`.

## Auth — `/auth`

| Method & path | Body | Notes |
|---|---|---|
| `POST /auth/register` | `{ email, password, confirmPassword, fullName }` | Rate-limited (20 req / 15 min per IP). Returns `{ session, user }`, or `{ needsConfirmation: true, user }` if the Supabase project requires email confirmation. |
| `POST /auth/login` | `{ email, password }` | Rate-limited (20 req / 15 min per IP). Returns `{ session, user }`. |
| `POST /auth/refresh` | `{ refreshToken }` | Exchanges a refresh token for a new session. The frontend calls this automatically on a 401. |
| `POST /auth/forgot-password` | `{ email, redirectTo? }` | Rate-limited (20 req / 15 min per IP). Triggers Supabase's password-reset email. `redirectTo` is only honored if its origin matches `CORS_ORIGIN` — anything else is silently dropped (see [SECURITY.md](./SECURITY.md)). |
| `POST /auth/logout` 🔒 | — | Invalidates the session server-side. |
| `GET /auth/me` 🔒 | — | Returns `{ user, enrollments }` — the profile row plus all active enrollments. This is what `AuthProvider` calls on every route change. |

## Onboarding — `/onboarding` (all 🔒)

| Method & path | Body | Notes |
|---|---|---|
| `POST /onboarding/enrollment` | `{ languageCode }` | Creates an active enrollment at level A1. `languageCode` is one of `en\|fr\|pt\|es\|ja\|zh`. |
| `PATCH /onboarding/native-language` | `{ nativeLanguage }` | Free-text-ish code (not restricted to the 6 learning languages — the app offers 18 native-language options). |
| `PATCH /onboarding/diagnostic` | `{ enrollmentId, level }` | Sets the level from the placement quiz and marks `diagnostic_completed`. |
| `POST /onboarding/complete` | `{ dailyGoalMinutes, activeDays }` | Marks onboarding done. **Returns 409 with `code: "NO_ENROLLMENT"`** if the user has no active enrollment yet — the frontend redirects back to the language step on this specific code rather than trapping the account (see [SECURITY.md](./SECURITY.md)). |

## Lessons — `/lessons` (all 🔒)

| Method & path | Notes |
|---|---|
| `GET /lessons?enrollmentId=` | Lessons for that enrollment's language + current level, plus this enrollment's `lesson_progress` rows. |
| `GET /lessons/:lessonId?enrollmentId=` | Lesson + its exercises, ordered. 404s if the lesson doesn't exist or the enrollment isn't the caller's. |
| `POST /lessons/:lessonId/complete` | Body `{ enrollmentId, score, timeSpentSeconds }`. `score` is clamped to `[0,1]` server-side before XP is computed — don't trust the client's number. Calls the `increment_xp` RPC, logs an `activity_logs` row, and seeds `srs_items` for every `vocabulary_reference` word matching the lesson's language+level (see [DATABASE.md](./DATABASE.md#how-srs-items-get-created)). Returns `{ xpEarned, leveledUp }`: if this was the last remaining lesson at the enrollment's current CEFR level, `current_level` is auto-advanced and `leveledUp` carries the new level (otherwise `null`) — see [ARCHITECTURE.md](./ARCHITECTURE.md). |

## SRS (spaced repetition) — `/srs` (all 🔒)

| Method & path | Notes |
|---|---|
| `GET /srs/due?enrollmentId=&limit=20` | Vocabulary items due for review now, joined with `vocabulary_reference`. |
| `POST /srs/:itemId/review` | Body `{ quality, enrollmentId }`, `quality` is `0-5` (SM-2 grading). Recomputes ease factor / interval / next review date. |
| `POST /srs/seed` | Body `{ enrollmentId, lessonId, vocabularyIds }`. Upserts new due items, ignoring duplicates. |

## Activity — `/activity` (all 🔒)

| Method & path | Notes |
|---|---|
| `POST /activity` | Body `{ enrollmentId, activityType, durationMinutes, xpEarned, metadata? }`. Enforces a 15-minute minimum session and a 360-minute daily cap (`429` with `blocked: true` past the cap). `xpEarned` is clamped to `durationMinutes × 20` regardless of what's sent — see [SECURITY.md](./SECURITY.md). Calls `update_streak` after a successful log. **Not called by the frontend today** — Practice used to be its only caller, but its 15-minute floor never fit a single 2-5 minute practice prompt (see `/practice` below); Practice now logs through its own route instead. Kept for a future free-form study-session use case. |
| `GET /activity/daily` | Today's logs plus `totalMinutes`, `totalXP`, `limitMinutes`. Aggregates every `activity_logs` row regardless of which route inserted it (lessons, practice, this route), so it stays accurate either way. |

## Practice — `/practice` (all 🔒)

| Method & path | Notes |
|---|---|
| `GET /practice?languageCode=&level=&mode=` | Prompts for one language + level + mode (`speaking\|shadowing\|debate\|writing`), ordered by `order_index`. Reference content — same "any authenticated user" RLS pattern as `lessons`/`vocabulary_reference`. |
| `POST /practice/:promptId/complete` | Body `{ enrollmentId, durationSeconds, wordCount? }`. Logs a discrete completion directly to `activity_logs` — deliberately bypasses `POST /activity`'s 15-minute floor (a single prompt is a 2-5 minute burst, not a study session) in favor of a 20-second floor for oral modes (`speaking`/`shadowing`/`debate`) or a word-count floor for `writing` (half of the prompt's `target_words`, enforced server-side regardless of what the client claims). `durationMinutes` for XP purposes is `round(durationSeconds / 60)` clamped to a 1-minute minimum; XP is `durationMinutes × 12`. Still enforces the 360-minute daily cap (`429` with `blocked: true`) and calls `update_streak`. Mode maps to `activity_logs.activity_type` as `speaking→speaking`, `debate→speaking`, `shadowing→listening`, `writing→writing`; `metadata` records `{ prompt_id, mode, language_code, level, word_count }`. |

## Dashboard — `/dashboard` (all 🔒)

| Method & path | Notes |
|---|---|
| `GET /dashboard` | `{ profile, enrollment, stats, activeDates, nextLesson }` for the main dashboard. `enrollment`/`stats` are `null` if the user has no active enrollment yet. |
| `GET /dashboard/progress` | `{ enrollment, logs }` for the Progress page. |
| `PATCH /dashboard/settings/daily-goal` | Body `{ dailyGoalMinutes }` (5-240). |

## Error shape reference

```jsonc
// Validation failure (zod)
{ "success": false, "error": "Datos inválidos" }

// Not authenticated (missing/invalid/expired token)
{ "success": false, "error": "No autenticado" }   // HTTP 401

// Onboarding-complete guard tripped
{ "success": false, "error": "Primero elige un idioma para aprender.", "code": "NO_ENROLLMENT" } // HTTP 409

// Daily activity cap
{ "success": false, "blocked": true, "error": "Límite diario alcanzado (360 min)" } // HTTP 429

// Rate limit hit (auth routes)
{ "success": false, "error": "Demasiados intentos. Intenta de nuevo más tarde." } // HTTP 429
```
