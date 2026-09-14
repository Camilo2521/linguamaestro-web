# Architecture

## Why this split looks the way it does

The app started as a single Next.js project where Server Components and
Server Actions queried Supabase directly from page code. Splitting that into
"frontend" and "backend" as two independently-runnable projects meant
removing every direct Supabase call from the frontend and replacing it with
HTTP calls to a real API — there's no partial version of this: either a page
talks to Supabase, or it talks to the backend, not both. The backend is a
plain Express app (not Next.js API routes) so it has no framework coupling
to the frontend and can be deployed, scaled, or replaced independently.

## Auth: bearer tokens, not cookies

The original app used Supabase's cookie-based SSR session, checked in
`middleware.ts` before every request. That doesn't work once the frontend
and backend are different origins with no shared cookie jar, so auth moved
to a token model:

1. `POST /auth/login` or `/auth/register` on the backend returns a Supabase
   `{ access_token, refresh_token }` session.
2. The frontend stores both in `localStorage` (`frontend/lib/api/client.ts`).
3. Every subsequent API call attaches `Authorization: Bearer <access_token>`.
4. The backend's `requireAuth` middleware (`backend/src/middleware/auth.ts`)
   validates that token against Supabase Auth on every request and attaches
   `req.userId` / `req.accessToken`.
5. On a 401, the frontend's API client transparently calls
   `POST /auth/refresh` with the stored refresh token and retries once
   before giving up (see `tryRefresh` in `frontend/lib/api/client.ts`).

One consequence: route protection (redirect to `/login`, gate onboarding vs.
app routes) can no longer live in Next.js middleware, since middleware runs
on the server/edge and has no access to `localStorage`. That logic now
lives in `frontend/components/providers/AuthProvider.tsx`, which runs on
every route change, checks for a token, calls `GET /auth/me`, and redirects
based on the response — the same three rules `middleware.ts` used to
enforce (unauthenticated → `/login`, authenticated + onboarding incomplete →
`/onboarding/welcome`, authenticated + onboarding done + on an onboarding
page → `/dashboard`).

## Two kinds of Supabase client on the backend

`backend/src/lib/supabase.ts` exports two clients, and which one a route
uses is a real security decision, not a style choice:

- **`getUserClient(accessToken)`** — scoped to the calling user's token.
  Every query runs through Postgres RLS as that user. This is the default;
  almost every route uses it.
- **`serviceClient`** — the service-role key, bypasses RLS entirely. Only
  used where a route genuinely needs to escape row ownership: reading a
  signed URL for someone's exam video, or writing the AI-graded result after
  evaluation. Every route that uses `serviceClient` must verify ownership
  itself first (see the exam-evaluation route below) — there's no RLS safety
  net once you're on this client.

## Request flow: a normal read/write

```
Browser              Frontend (Next.js)         Backend (Express)              Supabase
  |                        |                          |                            |
  |  click "Continue"      |                          |                            |
  |----------------------->|  POST /onboarding/       |                            |
  |                        |  enrollment              |                            |
  |                        |  Authorization: Bearer.. |                            |
  |                        |------------------------->|  requireAuth: auth.getUser |
  |                        |                          |--------------------------->|
  |                        |                          |<--------------------------|
  |                        |                          |  insert into enrollments   |
  |                        |                          |  (user's own RLS-scoped    |
  |                        |                          |   client)                  |
  |                        |                          |--------------------------->|
  |                        |<-------------------------|                            |
  |<-----------------------|                          |                            |
```

## Request flow: the exam evaluation pipeline

This is the most privileged path in the app, so it's worth tracing in full.
`GET /exam/attempts/:attemptId/evaluate` (`backend/src/routes/exam.routes.ts`)
is a Server-Sent Events stream, opened from the frontend with a plain
`EventSource` (`frontend/components/exam/ProcessingStream.tsx`). Browsers'
`EventSource` can't set custom headers, so this one endpoint accepts the
access token as a `?token=` query param instead of an `Authorization`
header — `requireAuth` checks both (see the middleware). Once authenticated:

1. The route re-fetches the attempt with the **service client** (it needs to
   read a signed storage URL next, which RLS-scoped queries can't do) —
   then immediately checks `attempt.user_id === req.userId` before doing
   anything else. Skipping this check would let anyone who knows/guesses an
   attempt id read someone else's exam and trigger billed AI calls on it —
   this was a real vulnerability found and fixed during development (see
   [SECURITY.md](./SECURITY.md)).
2. If `attempt.status === 'completed'` already, it replays the stored
   `ai_feedback` instead of re-running Whisper + Claude — otherwise every
   page refresh on the results screen would re-bill both APIs.
3. Otherwise: creates a signed URL for the video in the `exam-videos`
   bucket, downloads it, sends it to OpenAI's Whisper API for transcription,
   then sends the transcript to Claude with a rubric prompt for the 5 CEFR
   dimensions.
4. The 5 dimension scores are clamped to `[0,1]` and averaged into
   `overall_score` **on the backend** — the route does not trust a
   model-reported `overall_score`/`passed` field, because an inconsistent
   response would otherwise silently mis-advance a user's CEFR level. Pass/
   fail is decided by comparing that computed average to the level's real
   threshold (`getMinScore`).
5. The result is written to `exam_attempts` and, on a pass, the enrollment's
   `current_level` is advanced — both via the service client, since by this
   point ownership has already been proven.

## Data ownership: RLS is the primary guard, the backend is the second one

Every user-owned table (`users`, `enrollments`, `lesson_progress`,
`srs_items`, `activity_logs`, `exam_attempts`) has Postgres RLS policies
that key off `auth.uid()` (see [DATABASE.md](./DATABASE.md)). Because the
backend's default client (`getUserClient`) carries the real user's JWT, RLS
enforces ownership even if a route forgot to add a `.eq('user_id', ...)`
filter. The exceptions are the handful of routes using `serviceClient` —
those are the ones that need manual ownership checks in application code,
and they're called out explicitly in the route files and in
[SECURITY.md](./SECURITY.md).
