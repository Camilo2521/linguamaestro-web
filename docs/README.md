# LinguaMaestro

LinguaMaestro is a CEFR-certified language-learning app: onboarding + placement,
spaced-repetition vocabulary review (SM-2), gamified lessons, and an
AI-graded oral exam (Whisper transcription + Claude evaluation).

The project is split into three independent projects, each with its own
`package.json` and its own way of running:

| Project | What it is | Tech |
|---|---|---|
| [`frontend/`](../frontend) | The web app UI | Next.js 15 (App Router), React 19, Zustand, React Query |
| [`backend/`](../backend) | The REST API | Express + TypeScript, Supabase (Postgres + Auth + Storage) |
| [`docs/`](.) (this folder) | Documentation | Markdown |

```
                 HTTP (JSON + SSE)                Supabase client libs
   frontend  ───────────────────────▶  backend  ───────────────────────▶  Supabase
 (Next.js UI)  ◀───────────────────── (Express)  ◀─────────────────────  (Postgres,
                  Bearer <token>                   anon key / service         Auth,
                                                    role key                Storage)
```

The frontend never talks to Supabase directly and holds no Supabase
credentials — every read and write goes through the backend's REST API,
authenticated with a Supabase access token the frontend stores after
login/register. The backend is the only project holding Supabase
credentials (anon key **and** the service-role key), and it's responsible
for enforcing that a user can only touch their own data.

## Quick start

You need three terminals.

**1. Database** — nothing to run locally; both other projects point at your
Supabase project. See [DATABASE.md](./DATABASE.md) for how to set the schema
up on a fresh project.

**2. Backend**
```
cd backend
cp .env.example .env      # fill in your Supabase + AI provider keys
npm install
npm run dev                # http://localhost:4000
```

**3. Frontend**
```
cd frontend
npm install
npm run dev                # http://localhost:3000
```

`frontend/.env.local` only needs one variable:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Where to go next

- [ARCHITECTURE.md](./ARCHITECTURE.md) — how auth, requests, and the exam
  pipeline flow between the three pieces, and why the split looks the way it
  does.
- [API.md](./API.md) — every backend endpoint, its auth requirement, and its
  request/response shape.
- [DATABASE.md](./DATABASE.md) — table-by-table schema reference and the two
  RPC functions the backend calls.
- [SECURITY.md](./SECURITY.md) — the security model (who can call what) and
  the fixes that shaped it — worth reading before adding a new endpoint.
