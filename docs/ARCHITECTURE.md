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
- **`serviceClient`** — the service-role key, bypasses RLS entirely. For a
  route that genuinely needs to escape row ownership (e.g. reading a signed
  storage URL on someone's behalf). No current route uses it — its one
  caller was the exam-evaluation pipeline, removed along with the oral-exam
  feature — but any future route that reaches for it must verify ownership
  itself first, in application code, since there's no RLS safety net once
  you're on this client.

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

## Data ownership: RLS is the primary guard, the backend is the second one

Every user-owned table (`users`, `enrollments`, `lesson_progress`,
`srs_items`, `activity_logs`) has Postgres RLS policies that key off
`auth.uid()` (see [DATABASE.md](./DATABASE.md)). Because the backend's
default client (`getUserClient`) carries the real user's JWT, RLS enforces
ownership even if a route forgot to add a `.eq('user_id', ...)` filter. Any
future route reaching for `serviceClient` instead would need its own manual
ownership check in application code — see the note on that client above
and [SECURITY.md](./SECURITY.md).

## Note: the oral exam / CEFR certification feature was removed

An earlier version of this app had a full oral-exam pipeline: record a
video, upload it, transcribe with Whisper, grade with Claude against a
5-dimension CEFR rubric, and advance the user's `current_level` on a pass.
That whole feature — routes, frontend pages, the `exam_attempts` table, the
`exam-videos` storage bucket — was deliberately removed
(`0008_remove_exam_certification.sql`). The CEFR level system itself (A1
through C2 and NATIVE) stays: it's still how lessons, vocabulary, and
Practice content are organized and how a learner progresses.

Removing the exam also removed the only thing that ever advanced
`enrollments.current_level` after onboarding — without a replacement, a
learner who finished every lesson at their level would have nowhere to go.
`POST /lessons/:lessonId/complete` (`backend/src/routes/lessons.routes.ts`)
now does that instead: after marking a lesson complete, it checks whether
every lesson at the enrollment's current `language_code` + `current_level`
is now `completed` in `lesson_progress`, and if so advances `current_level`
to `getNextLevel(current_level)` (`backend/src/utils/levels.ts`) — no exam,
no gate, just content completion. The response carries `leveledUp` (the new
level, or `null`) so the frontend can show a level-up celebration and patch
the enrollment in the session store without waiting for a refetch.
