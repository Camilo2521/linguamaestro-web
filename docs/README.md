# LinguaMaestro

LinguaMaestro is a CEFR-structured language-learning web app: onboarding
with a placement quiz, lessons organized by CEFR level with automatic level
advancement, spaced-repetition vocabulary review (SM-2), and a Practice
section with seven modes — across 6 languages (`en`, `fr`, `pt`, `es`,
`ja`, `zh`) and 7 levels (A1, A2, B1, B2, C1, C2, NATIVE).

> LinguaMaestro does **not** issue certifications. CEFR levels are used as
> a progression scheme only; an earlier oral-exam/certification feature was
> deliberately removed (see [ARCHITECTURE.md](./ARCHITECTURE.md)).

## Features

- Email/password registration and login (Supabase Auth, via the backend).
- Onboarding: target language → native language → placement quiz →
  daily goal and study days.
- Lessons per language + CEFR level, with exercise types multiple choice,
  fill-in-the-blank, flashcard, speaking and reorder. Completing every
  lesson at the current level advances the learner to the next level.
- Vocabulary review with SM-2 spaced repetition; words enter the review
  deck when the lesson that introduces them is completed.
- Practice, seven modes: `speaking`, `shadowing`, `debate`, `writing`,
  `multiple_choice`, `fill_blank`, `pronunciation`. The last three are
  auto-graded server-side (pronunciation uses the browser's Web Speech API,
  which is only available in some browsers — mainly Chrome and Edge).
- Dashboard (streak, due cards, next lesson, daily progress), Progress page,
  Settings.

## Repository layout

Three independent projects, each with its own `package.json`:

| Project | What it is | Tech |
|---|---|---|
| [`frontend/`](../frontend) | Web UI | Next.js 15 (App Router), React 19, TypeScript, Zustand, TanStack React Query, Tailwind CSS |
| [`backend/`](../backend) | REST API | Node.js, Express 4, TypeScript, Zod, `@supabase/supabase-js` |
| [`docs/`](.) | Documentation | Markdown |

```
                 HTTP (JSON)                      Supabase client libs
   frontend  ───────────────────────▶  backend  ───────────────────────▶  Supabase
 (Next.js UI)  ◀───────────────────── (Express)  ◀─────────────────────  (Postgres,
                Authorization: Bearer                user-scoped JWT          Auth)
```

**Architectural rule:** the frontend never talks to Supabase directly and
holds no Supabase credentials. Every read and write goes through the
backend's REST API, authenticated with the Supabase access token the
frontend received from `/auth/login` or `/auth/register`. The backend is the
only project holding Supabase keys.

## Requirements

- Node.js ≥ 22 and npm (the installed `@supabase/supabase-js` needs a native
  WebSocket, Node 22+). Verified locally with Node 25 / npm 11.
- A Supabase project (Postgres + Auth). Nothing database-related runs
  locally.

## Setup

### 1. Database

Run the SQL migrations in [`backend/supabase/migrations/`](../backend/supabase/migrations)
in the Supabase SQL Editor. **Read [DATABASE.md](./DATABASE.md#migrations)
first** — `0001_init.sql` drops and recreates every table, so it must only
ever be run on an empty project.

The repository contains no seed content (lessons, exercises, vocabulary,
practice prompts). A fresh database starts empty; content has to be loaded
separately.

### 2. Backend

```
cd backend
npm install
# create backend/.env (see below)
npm run dev                # http://localhost:4000, GET /health → { ok: true }
```

`backend/.env`:

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (default `4000`) | HTTP port |
| `CORS_ORIGIN` | yes in production (default `http://localhost:3000`) | Comma-separated list of allowed frontend origins. Any `https://*.vercel.app` origin is also allowed automatically (see `backend/src/app.ts`). |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | yes | Supabase anon key — used for auth calls and, combined with the user's JWT, for every data query |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Service-role key. No route uses it today; the client is created lazily only if a route calls `getServiceClient()`, so leave it unset unless needed. Never expose it. |

A template lives at `backend/.env.example` (and `frontend/.env.example`
for the frontend); the root `.gitignore` excludes every `.env*` file except
these templates.

### 3. Frontend

```
cd frontend
npm install
# create frontend/.env.local:
#   NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev                # http://localhost:3000
```

`NEXT_PUBLIC_API_URL` is the only frontend variable. It is public by design
(embedded in the browser bundle) — never put a secret in a `NEXT_PUBLIC_*`
variable.

## Scripts

| Where | Command | What it does |
|---|---|---|
| backend | `npm run dev` | Dev server with reload (`tsx watch`) |
| backend | `npm run build` / `npm start` | Compile to `dist/` / run compiled build |
| backend | `npm run type-check` | `tsc --noEmit` |
| backend | `npm test` | Vitest route tests (Supabase is mocked; no network) |
| frontend | `npm run dev` | Next.js dev server (Turbopack) |
| frontend | `npm run build` / `npm start` | Production build / serve it |
| frontend | `npm run type-check` | `tsc --noEmit` |
| frontend | `npm test` | Vitest (watch mode); `test:unit`, `test:integration`, `test:coverage` for subsets |
| frontend | `npm run test:e2e` | Playwright end-to-end tests (needs the app running; see `playwright.config.ts`) |
| frontend | `npm run lint` | `next lint` — **not functional yet**: no ESLint config exists, so it prompts interactively |

## Deployment

Reference setup: backend on **Render** (free plan) via the
[`render.yaml`](../render.yaml) Blueprint, frontend on **Vercel** with
*Root Directory* = `frontend`, database on Supabase. The backend runs behind
Render's proxy (`app.set('trust proxy', 1)` in `backend/src/app.ts`), and
CORS already accepts any `https://*.vercel.app` origin. Free Render services
sleep after inactivity; the first request afterwards takes ~1 minute.

Order: deploy the backend first, set the frontend's `NEXT_PUBLIC_API_URL`
to its URL, deploy the frontend, then put the frontend URL in the backend's
`CORS_ORIGIN`. In any environment:

- set `CORS_ORIGIN` on the backend to the real frontend origin(s);
- set `NEXT_PUBLIC_API_URL` on the frontend to the backend's public URL
  at **build** time (it is inlined into the bundle);
- apply migrations to the production Supabase project before deploying code
  that depends on them.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — responsibilities of each project,
  auth flow, state management, error handling, module layout.
- [API.md](./API.md) — every backend endpoint: auth, parameters,
  validation, responses, errors, auto-grading.
- [DATABASE.md](./DATABASE.md) — migrations, tables, constraints, indexes,
  RLS, RPCs, SRS and progress tracking.
- [SECURITY.md](./SECURITY.md) — security model, fixes already made, and
  known open risks. Read before adding an endpoint.
