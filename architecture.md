# Architecture

## System shape

```
┌──────────────────────────────────────────────────────────────┐
│                       Vercel (Fluid Compute)                 │
│                                                              │
│  Next.js App Router (RSC)                                    │
│   ├─ / (marketing)                                           │
│   ├─ /programs           ── listPrograms()   ─┐              │
│   ├─ /programs/[p]/[s]   ── getProgramBySlug()│              │
│   ├─ /scope-lookup       ── findByDomain()    │──► Postgres  │
│   ├─ /feed               ── newestPrograms()  │    (Neon)    │
│   └─ /api/cron/ingest    ── ingestAll()       ┘              │
│                              │                                │
│                              ▼                                │
│                   arkadiyt/bounty-targets-data                │
│                     (GitHub raw JSON)                         │
└──────────────────────────────────────────────────────────────┘
```

## Stack decisions

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router | RSC lets pages query DB directly, no API layer needed |
| Runtime | Fluid Compute (Node) | Default, no edge quirks, 300s max for ingest |
| DB | Postgres via Neon | Serverless, cheap, `tsvector` for FTS |
| ORM | Drizzle | Typed, no runtime, migrations via `drizzle-kit` |
| Styling | Tailwind 4 | Design tokens in `globals.css`, no component lib |
| Validation | Zod | Only where data crosses trust boundary (external JSON, URL params) |
| Cron | Vercel Cron → `/api/cron/ingest` | Bearer-auth via `CRON_SECRET` |

## Data flow

**Ingest (hourly cron):**
1. `GET /api/cron/ingest` (Bearer auth)
2. `ingestAll()` iterates 6 platforms
3. Per platform: fetch normalized JSON from bounty-targets-data → upsert `programs` on `(platform, slug)` → replace `scopes` rows for that program → write `ingest_runs` row
4. Errors per-platform are captured, don't abort the batch

**Read paths (server components):**
- `/programs` — one query with `WHERE` from URL params, optional `INNER JOIN scopes` for asset-type filter, `count(*)` for total
- `/programs/[p]/[s]` — `SELECT` program + `SELECT` scopes (2 queries, no JOIN needed)
- `/scope-lookup` — `JOIN scopes ON programs` with `ILIKE %domain%`
- `/feed` — `ORDER BY first_seen_at DESC LIMIT 50`

## Schema

- `programs (id, platform, slug UNIQUE, name, handle, url, program_type, offers_bounty, offers_swag, managed, min_bounty, max_bounty, currency, submission_state, last_updated_at, first_seen_at, raw JSONB, search_text)`
- `scopes (id, program_id FK, identifier, asset_type, in_scope, eligible_for_bounty, severity, instruction)`
- `sources (id, name UNIQUE, url, last_run_at, last_status, last_error)`
- `ingest_runs (id, source_id FK, started_at, finished_at, status, programs_upserted, scopes_upserted, error)`

`raw` JSONB is kept for debugging + future re-parse without re-fetching.

## Trust boundaries

- **External JSON** (bounty-targets-data) — parsed loosely, missing fields tolerated. No schema validation panic; skip malformed records.
- **URL search params** — coerced explicitly (`Number(...)`, `parseArray`), no `any`.
- **Cron auth** — Bearer token, constant-time not needed for a hobby-tier endpoint (upgrade if abuse appears).

## What is deliberately not here

- No auth. Add NextAuth in phase 2.
- No caching layer. Postgres + RSC is fast enough at this scale (~5k programs, ~50k scopes).
- No queue. Ingest is a single serial pass — fine under 300s.
- No client-side data fetching. Everything is RSC.
- No CDN for assets beyond Vercel default.

## Failure modes

| Failure | Behavior |
|---|---|
| `DATABASE_URL` unset | Pages render amber "DB_NOT_CONNECTED" panel, no crash |
| Ingest source 4xx/5xx | That platform's `ingest_runs` row logs error; others continue |
| Malformed record | Skipped, ingest continues |
| Cron unauthorized | 401, no work done |
