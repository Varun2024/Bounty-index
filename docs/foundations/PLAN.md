# Bug Bounty Finder — Plan

Aggregated, filterable index of bug bounty + VDP programs across HackerOne, Bugcrowd, Intigriti, YesWeHack, Immunefi, and self-hosted programs.

## Decisions locked
- **MVP is public-only.** Accounts + saved filters land in phase 2.
- **Monetization deferred.** Revisit after audience exists. Candidates: pro tier, affiliate, job board, sponsored slots. Keep accounts-ready in schema.
- **Data source:** `arkadiyt/bounty-targets-data` (MIT) as primary — normalized JSON updated hourly, gets ~80% coverage day one. Layer official platform APIs (HackerOne directory, Bugcrowd engagements) where they add signal. No direct scraping of platform HTML.

## Stack
- Next.js App Router + TS + Turbopack
- Postgres (Neon) + Drizzle ORM
- Postgres `tsvector` for full-text — no Elastic
- Tailwind + shadcn/ui (restyled, not stock)
- Vercel Cron + Fluid Compute for the ingest job
- Auth: skipped in MVP

## MVP scope
- [ ] Scaffold Next.js
- [ ] DB schema: `programs`, `scopes`, `sources`, `ingest_runs`
- [ ] Ingest job pulling `bounty-targets-data` → normalized rows
- [ ] `/programs` — filterable/searchable index (table default, card opt-in)
- [ ] `/programs/[slug]` — full detail
- [ ] `/scope-lookup` — paste domain → matching programs
- [ ] `/feed` — new programs, web view + RSS
- [ ] Filters: reward min/max, asset type, tech tag, platform, program type, has-bounty
- [ ] Keyboard-first nav (`/`, `f`, `j/k`)

## Phase 2
- Accounts + saved filters
- Alerts (email / Discord / webhook)
- Watchlist + private notes
- Payout stats from public disclosures
- Writeups linked per program (Pentester Land, Hacktivity)
- "Match my stack" ranking
- Competition estimate where data allows

## Explicitly skipped
Report submission, hacker profiles, gamification, mobile app, AI vuln suggester.

## UI direction
Editorial + data-dense (Linear × Bloomberg terminal). Left rail filters, compact table default, monospace for scope, dark default, accent color used only for signal ("new", "payout up", "in-scope match").

## Structure
```
app/
  (marketing)/            landing
  programs/               index
  programs/[slug]/        detail
  scope-lookup/           domain → programs
  feed/                   new programs (web + RSS)
  api/                    search, scope-check, cron
lib/scrapers/             one file per source
lib/db/                   schema, queries
```

## Progress log
- 2026-08-03 — Plan locked. Starting scaffold.
- 2026-08-03 — Next.js 16 + Tailwind 4 + TS scaffolded. Drizzle + postgres + zod installed.
- 2026-08-03 — Schema (`programs`, `scopes`, `sources`, `ingest_runs`) + client + drizzle config in place.
- 2026-08-03 — Ingest job for arkadiyt/bounty-targets-data (6 platforms) written. Cron route at `/api/cron/ingest`. Local run via `npm run ingest`.
- 2026-08-03 — Pages up: `/`, `/programs`, `/programs/[platform]/[slug]`, `/scope-lookup`, `/feed`. URL-driven filters, dark editorial UI, graceful DB-not-connected state. Typecheck clean.
- 2026-08-03 — DB connected. `db:push` + first `ingest` done.
- 2026-08-03 — Shipped: `vercel.ts` hourly cron, `/feed.xml` RSS, pagination on `/programs`, `robots.ts` + `sitemap.ts`.
- 2026-08-03 — Shipped: min-reward filter, keyboard shortcuts (`/`, `j`/`k`, `↵`, `Esc`), OG/Twitter meta on program detail via `generateMetadata`.

## Next up
- [ ] Connect Neon Postgres → set `DATABASE_URL` in `.env`
- [ ] `npm run db:push` to create tables
- [ ] `npm run ingest` for first data pull
- [ ] Wire Vercel Cron (hourly) to `/api/cron/ingest`
- [ ] Add `/feed.xml` RSS route
- [ ] Keyboard shortcuts (`/`, `j/k`) on `/programs`
