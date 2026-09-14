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
| `POST /lessons/:lessonId/complete` | Body `{ enrollmentId, score, timeSpentSeconds }`. `score` is clamped to `[0,1]` server-side before XP is computed — don't trust the client's number. Calls the `increment_xp` RPC and logs an `activity_logs` row. |

## SRS (spaced repetition) — `/srs` (all 🔒)

| Method & path | Notes |
|---|---|
| `GET /srs/due?enrollmentId=&limit=20` | Vocabulary items due for review now, joined with `vocabulary_reference`. |
| `POST /srs/:itemId/review` | Body `{ quality, enrollmentId }`, `quality` is `0-5` (SM-2 grading). Recomputes ease factor / interval / next review date. |
| `POST /srs/seed` | Body `{ enrollmentId, lessonId, vocabularyIds }`. Upserts new due items, ignoring duplicates. |

## Activity — `/activity` (all 🔒)

| Method & path | Notes |
|---|---|
| `POST /activity` | Body `{ enrollmentId, activityType, durationMinutes, xpEarned, metadata? }`. Enforces a 15-minute minimum session and a 360-minute daily cap (`429` with `blocked: true` past the cap). `xpEarned` is clamped to `durationMinutes × 20` regardless of what's sent — see [SECURITY.md](./SECURITY.md). Calls `update_streak` after a successful log. |
| `GET /activity/daily` | Today's logs plus `totalMinutes`, `totalXP`, `limitMinutes`. |

## Exam — `/exam` (all 🔒)

| Method & path | Notes |
|---|---|
| `GET /exam/overview` | The caller's (first) active enrollment with its `exam_attempts` embedded, newest first — powers the exam landing page. |
| `GET /exam/eligibility?enrollmentId=` | Hours studied / months enrolled / cooldown-since-last-attempt against the level's requirements. Informational — does not gate anything by itself. |
| `POST /exam/attempts` | Rate-limited (10 req / hour per IP). Body `{ enrollmentId }`. Re-checks eligibility server-side (the same computation as `GET /eligibility`) and **returns 403 with `{ reasons: string[] }`** if not eligible — this is the actual gate, not the GET above. Creates an attempt row with `status: 'recording'` on success. |
| `POST /exam/attempts/:attemptId/video` | `multipart/form-data`: `video` (file), `durationSeconds`. Uploads to the `exam-videos` bucket and flips status to `'processing'`. |
| `GET /exam/attempts/:attemptId` | Full attempt row + embedded enrollment info. |
| `GET /exam/attempts/:attemptId/evaluate` | **Server-Sent Events.** Streams `{type: 'step', step}` progress events, then one `{type: 'complete', data: <feedback>}` or `{type: 'error', message}`. Runs Whisper transcription + Claude grading; replays the stored result instead of re-running the pipeline if the attempt is already `completed`. Since browsers' `EventSource` can't set headers, this route accepts the token as `?token=` instead of an `Authorization` header — see [ARCHITECTURE.md](./ARCHITECTURE.md). |

## Dashboard — `/dashboard` (all 🔒)

| Method & path | Notes |
|---|---|
| `GET /dashboard` | `{ profile, enrollment, stats, activeDates, nextLesson }` for the main dashboard. `enrollment`/`stats` are `null` if the user has no active enrollment yet. |
| `GET /dashboard/progress` | `{ enrollment, attempts, logs }` for the Progress page. |
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

// Exam eligibility gate tripped (POST /exam/attempts)
{ "success": false, "error": "No cumples los requisitos para el examen", "reasons": ["..."] } // HTTP 403

// Rate limit hit (auth routes, exam attempt creation)
{ "success": false, "error": "Demasiados intentos. Intenta de nuevo más tarde." } // HTTP 429
```
