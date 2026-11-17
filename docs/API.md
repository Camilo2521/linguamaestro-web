# API Reference

Base URL: `http://localhost:4000` in development (`NEXT_PUBLIC_API_URL` on
the frontend). Request and response bodies are JSON (`express.json()`,
default 100 kB body limit).

## Conventions

**Envelope.** Every response is `{ success: boolean, ... }`. Success
payloads are under `data`; errors are
`{ success: false, error: string, code?: string, blocked?: boolean, fieldErrors?: object }`.
Error messages are in Spanish and meant to be shown to the user.

**Auth.** Routes marked 🔒 require `Authorization: Bearer <access_token>`,
the Supabase access token returned by `/auth/login`, `/auth/register` or
`/auth/refresh`. The `requireAuth` middleware validates the token with
Supabase Auth on every request; a missing, malformed, invalid or expired
token gets `401 { error: "No autenticado" }`. Every data query then runs
with the caller's JWT, so Postgres RLS enforces row ownership (see
[DATABASE.md](./DATABASE.md#row-level-security)).

**Validation.** Bodies and query strings are validated with Zod. A
validation failure is a `400` with a short message (most routes don't say
which field; auth routes add `fieldErrors`). Database errors on writes are
currently returned as `400` with the raw Postgres/PostgREST message — a
known issue, see [SECURITY.md](./SECURITY.md#open-risks).

**Rate limiting.** Only `POST /auth/register`, `/auth/login` and
`/auth/forgot-password` are rate-limited: 20 requests / 15 min per IP
(shared counter), then `429 { error: "Demasiados intentos. Intenta de nuevo más tarde." }`.

Enumerations used below:

- `languageCode`: `en | fr | pt | es | ja | zh`
- `level`: `A1 | A2 | B1 | B2 | C1 | C2 | NATIVE`
- `activityType`: `lesson | srs | speaking | listening | writing`

## Health

| Method & path | Notes |
|---|---|
| `GET /health` | `{ ok: true }`. No auth. For uptime checks. |

## Auth — `/auth`

| Method & path | Body | Behavior |
|---|---|---|
| `POST /auth/register` | `{ email, password, confirmPassword, fullName }` | Rate-limited. `password`: ≥ 8 chars, at least one uppercase letter and one digit; must equal `confirmPassword`. `fullName`: 2–80 chars. Returns `{ session, user }`, or `{ needsConfirmation: true, user }` when the Supabase project requires email confirmation. `400` with `fieldErrors` on validation failure; `400` with a Supabase message on signup failure (an existing email gets a specific "ya tiene una cuenta" message). |
| `POST /auth/login` | `{ email, password }` | Rate-limited. Returns `{ session, user }`. Wrong credentials → `401 "Email o contraseña incorrectos"`. |
| `POST /auth/refresh` | `{ refreshToken }` | Not rate-limited. Returns a new `{ session, user }`; an invalid/used refresh token → `401 "Sesión expirada"`. The frontend calls this automatically once on any `401`. |
| `POST /auth/forgot-password` | `{ email, redirectTo? }` | Rate-limited. Triggers Supabase's reset email. `redirectTo` is only forwarded if its origin equals `CORS_ORIGIN`; otherwise it is dropped and the Supabase project's default redirect is used. (When `CORS_ORIGIN` lists several origins, no `redirectTo` matches — known issue.) |
| `POST /auth/logout` 🔒 | — | Returns `{ success: true }`. **Does not currently revoke the session in Supabase** — see [SECURITY.md](./SECURITY.md#open-risks). The frontend discards its tokens locally. |
| `GET /auth/me` 🔒 | — | `{ user, enrollments }`: the caller's `users` row and all **active** enrollments. Called by `AuthProvider` on every route change. |

## Onboarding — `/onboarding` (all 🔒)

| Method & path | Body | Behavior |
|---|---|---|
| `POST /onboarding/enrollment` | `{ languageCode }` | Creates an active enrollment at level `A1` and returns it. Nothing prevents creating several enrollments for the same language. |
| `PATCH /onboarding/native-language` | `{ nativeLanguage }` | String of 2–10 chars (not restricted to the 6 learning languages). |
| `PATCH /onboarding/diagnostic` | `{ enrollmentId, level }` | Sets the enrollment's `current_level` from the placement quiz and marks `diagnostic_completed`. The level is chosen client-side and the endpoint can currently be called again at any time — known risk, see [SECURITY.md](./SECURITY.md#open-risks). |
| `POST /onboarding/complete` | `{ dailyGoalMinutes, activeDays }` | `dailyGoalMinutes`: integer 15–180. `activeDays`: non-empty array of integers 0–6 (0 = Monday … 6 = Sunday). Sets `onboarding_completed`. **`409 { code: "NO_ENROLLMENT" }`** if the user has no active enrollment; the frontend sends the user back to the language step. |

## Lessons — `/lessons` (all 🔒)

| Method & path | Behavior |
|---|---|
| `GET /lessons?enrollmentId=` | `enrollmentId` must be a UUID (`400` otherwise) and belong to the caller (`404` otherwise). Returns `{ lessons, progress }`: lessons for the enrollment's language + **current** level ordered by `order_index`, and this enrollment's `lesson_progress` rows (`lesson_id, completed, score`). |
| `GET /lessons/:lessonId?enrollmentId=` | Returns `{ lesson, exercises, enrollmentId }`, exercises sorted by `order_index`. `404` if the lesson doesn't exist or the enrollment isn't the caller's. Exercises include `correct_answer` (grading in Learn is done client-side). |
| `POST /lessons/:lessonId/complete` | Body `{ enrollmentId (uuid), score (number), timeSpentSeconds (int ≥ 0) }`. See below. Returns `{ xpEarned, leveledUp }`. |

`POST /lessons/:lessonId/complete`, step by step:

1. `score` is clamped to `[0, 1]`. XP = `round(score × 100)`, or `0` if
   this lesson was already completed for this enrollment.
2. Upserts `lesson_progress` (`completed = true`). RLS rejects an
   enrollment the caller doesn't own (`400`).
3. If XP > 0, calls the `increment_xp` RPC (also adds `XP / 100` hours to
   `total_study_hours`).
4. Inserts an `activity_logs` row (`activity_type = 'lesson'`,
   `duration_minutes = ceil(timeSpentSeconds / 60)`).
5. Seeds `srs_items` for the lesson's vocabulary (see
   [DATABASE.md](./DATABASE.md#how-srs-items-get-created)); existing items
   are left untouched.
6. If every lesson at the enrollment's current language + level is now
   completed, advances `current_level` to the next level
   (A1→A2→B1→B2→C1→C2→NATIVE; NATIVE is terminal) and returns it as
   `leveledUp`; otherwise `leveledUp` is `null`. A level with zero lessons
   never advances.

Steps 3–5 are side effects: their failures are logged server-side and do
not fail the request. The steps are not wrapped in a transaction.

## SRS (spaced repetition) — `/srs` (all 🔒)

| Method & path | Behavior |
|---|---|
| `GET /srs/due?enrollmentId=&limit=` | `enrollmentId` UUID; `limit` integer 1–100, default 20. Items with `next_review_at <= now`, oldest first, each joined with its `vocabulary_reference` (`word, translation, example_sentence, audio_url, image_url, pronunciation`). |
| `POST /srs/:itemId/review` | Body `{ quality (int 0–5), enrollmentId (uuid) }`. Recomputes the item with SM-2 (`backend/src/utils/srs-schedule.ts`) and updates `ease_factor`, `interval_days`, `repetitions`, `next_review_at`, `last_reviewed_at`, `total_reviews`. `404` if the item doesn't exist or isn't the caller's (RLS). `enrollmentId` is validated but not otherwise used. Returns `{ success: true }`. |
| `POST /srs/seed` | Body `{ enrollmentId, lessonId, vocabularyIds: uuid[] }`. Inserts new due items, ignoring ones already present. Not called by the current frontend (seeding happens on lesson completion). |

SM-2 as implemented: new ease = `EF + (0.1 − (5 − q)(0.08 + (5 − q)·0.02))`,
floored at 1.3 and applied on every review (including failed ones). If
`q < 3`: repetitions reset to 0, interval 1 day. Otherwise repetitions + 1
and interval = 1 day (first success), 6 days (second), then
`round(previous interval × new EF)`.

## Activity — `/activity` (all 🔒)

| Method & path | Behavior |
|---|---|
| `POST /activity` | Body `{ enrollmentId, activityType, durationMinutes (int), xpEarned (int ≥ 0), metadata? }`. Requires `durationMinutes ≥ 15` (`400`). Daily cap: if today's logged minutes + this session exceed 360 → `429 { blocked: true }`. `xpEarned` is clamped to `durationMinutes × 20`. Inserts into `activity_logs`, then calls `update_streak`. **Not called by the current frontend** (kept for a future free-form study-session feature). |
| `GET /activity/daily` | Today's logs plus `{ totalMinutes, totalXP, limitMinutes: 360 }`. Counts every `activity_logs` row regardless of which route created it. |

"Today" is the current **UTC** date on the server for both endpoints.

## Practice — `/practice` (all 🔒)

### `GET /practice?languageCode=&level=&mode=`

All three parameters required. `mode` is one of the seven modes below.
Returns the matching `practice_prompts` rows ordered by `order_index`
(every column, including `options`, `correct_answer` and `reference_text`).
Invalid parameters → `400 "Parámetros inválidos"`.

### `POST /practice/:promptId/complete`

Body:

| Field | Type | Used by |
|---|---|---|
| `enrollmentId` | uuid, required | all modes — must be the caller's (`404` otherwise) |
| `durationSeconds` | int ≥ 0, required | all modes — time gates and XP |
| `wordCount` | int ≥ 0, optional | `writing` |
| `answer` | string, optional | `multiple_choice`, `fill_blank` |
| `transcript` | string, optional | `pronunciation` |

`404` if the prompt doesn't exist. Per-mode rules:

| Mode | Gate (`400` if not met) | Grading → `correct` |
|---|---|---|
| `speaking` | `durationSeconds ≥ 20` | none (`null`) |
| `shadowing` | `durationSeconds ≥ 20` | none (`null`) |
| `debate` | `durationSeconds ≥ 20` | none (`null`) |
| `writing` | `wordCount ≥ max(5, round(target_words × 0.5))` (`target_words` defaults to 30) | none (`null`) |
| `multiple_choice` | `answer` present | exact, case-sensitive match against `correct_answer` |
| `fill_blank` | non-blank `answer` | Levenshtein similarity of trimmed, lower-cased `answer` vs `correct_answer` ≥ **0.85** |
| `pronunciation` | non-blank `transcript` and `durationSeconds ≥ 2` | Levenshtein similarity of trimmed, lower-cased `transcript` vs `reference_text` ≥ **0.70** |

Grading is done on the server against the stored prompt; a client-reported
"correct" is never trusted. It is a simple text-similarity check, **not** a
linguistic or phonetic assessment: punctuation and accents are not
normalized, and for pronunciation the transcript comes from the browser's
speech recognizer. It must not be presented as a pronunciation
certification. `wordCount` and `durationSeconds` are reported by the client.

After the gate:

- `durationMinutes = max(1, round(durationSeconds / 60))`.
- Daily cap: today's minutes + `durationMinutes` > 360 →
  `429 { blocked: true }`.
- XP = `durationMinutes × 12`, or `0` when `correct === false`. Practice XP
  is recorded in `activity_logs.xp_earned` only — it is **not** added to
  `enrollments.xp_total`.
- Inserts an `activity_logs` row; `activity_type` by mode:
  `speaking, debate, multiple_choice, pronunciation → speaking`,
  `shadowing → listening`, `writing, fill_blank → writing`. `metadata` =
  `{ prompt_id, mode, language_code, level, word_count, correct }`.
- Calls `update_streak` (failure logged, not returned).

Returns `{ xpEarned, correct }`. A wrong answer is still logged (it counts
for the streak and daily minutes) but earns 0 XP.

## Dashboard — `/dashboard` (all 🔒)

| Method & path | Behavior |
|---|---|
| `GET /dashboard` | `{ profile, enrollment, stats, activeDates, nextLesson }`. Uses the **first** active enrollment. `stats = { total_study_hours, srs_cards_due, lessons_completed, current_streak }`. `activeDates`: distinct UTC dates (`YYYY-MM-DD`) with activity in the last 90 days. `nextLesson`: first not-completed lesson at the current level, or `null`. With no active enrollment: `enrollment`, `stats` and `nextLesson` are `null`. |
| `GET /dashboard/progress` | `{ enrollment, logs }`: first active enrollment and the 30 most recent activity logs. `404` if there is no active enrollment. |
| `PATCH /dashboard/settings/daily-goal` | Body `{ dailyGoalMinutes }`, integer 5–240 (note: onboarding accepts 15–180). Updates `users.daily_goal_minutes`. |

## Error reference

| Status | When | Body |
|---|---|---|
| 400 | Zod validation failure | `{ error: "Datos inválidos" }` (or a route-specific message; auth routes add `fieldErrors`) |
| 400 | Malformed JSON body | `{ error: "JSON inválido en el cuerpo de la petición" }` |
| 400 | Database rejected a write (incl. RLS) | `{ error: <database message> }` |
| 401 | Missing/invalid/expired token | `{ error: "No autenticado" }` |
| 401 | Bad login / bad refresh token | `{ error: "Email o contraseña incorrectos" }` / `{ error: "Sesión expirada" }` |
| 404 | Resource not found or not owned | route-specific message |
| 404 | Unknown route | `{ error: "Ruta no encontrada" }` |
| 409 | Onboarding completed without enrollment | `{ code: "NO_ENROLLMENT", error: "Primero elige un idioma para aprender." }` |
| 429 | Daily 360-minute cap | `{ blocked: true, error: "Límite diario alcanzado (360 min)" }` |
| 429 | Auth rate limit | `{ error: "Demasiados intentos. Intenta de nuevo más tarde." }` |
| 500 | Unhandled exception | `{ error: "Error interno del servidor" }` (details only in server logs) |
