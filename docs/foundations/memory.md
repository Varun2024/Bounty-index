# Memory

Persistent notes for future sessions. Read this first when resuming work.

## Project identity

**Bug Bounty Finder** — public aggregator of bug bounty + VDP programs across HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy, HackenProof.

Owner: Maaz (maaz@sulfurrecovery.com). Personal project, no team.

## Key decisions (locked)

- **Data source:** `arkadiyt/bounty-targets-data` (MIT). No direct scraping of platform HTML. Official APIs allowed but not required for MVP.
- **Stack:** Next.js 16 App Router + Postgres (Neon) + Drizzle + Tailwind 4. No component library.
- **Auth:** Not in MVP. Add in Phase 2 with NextAuth (GitHub OAuth).
- **Monetization:** Deferred to Phase 4. Never paywalling the core index.
- **UI direction:** Dark editorial/terminal. Emerald `#34d399` is the only accent. Mono for identifiers, sans for prose.

## What's built

- Schema: `programs`, `scopes`, `sources`, `ingest_runs`
- Ingest: `lib/ingest/bounty-targets.ts` (6 platforms, per-platform failure isolated)
- Cron: `GET /api/cron/ingest` with Bearer auth (`CRON_SECRET`)
- Local run: `npm run ingest`
- Pages: `/`, `/programs` (filters + table), `/programs/[platform]/[slug]`, `/scope-lookup`, `/feed`
- URL is source of truth for all filter state

## What's not built yet

See `phases.md` Phase 1 checklist. Highlights:
- Vercel Cron config
- `/feed.xml` RSS
- Reward range filter
- Keyboard shortcuts
- Pagination UI

## Non-obvious gotchas

- `programs.raw` is JSONB — keep it, cheap insurance for schema changes upstream
- `scopes` are replaced wholesale per ingest (delete + insert), not diffed
- `first_seen_at` set once at insert, never updated — this is what powers the `/feed` "newest" logic
- `search_text` column is denormalized for `ILIKE`; upgrade to `tsvector` when result count justifies it
- The ingest script uses `cache: 'no-store'` on fetches; Vercel would otherwise cache the raw GitHub JSON

## User preferences observed

- Wants planning docs before big changes (asked for architecture/rules/phases/design/memory files)
- Ships fast: told me "go with recommendation" and "start scaffolding" without deliberating
- Comfortable deferring monetization until audience exists
- Wants progress tracked (PLAN.md progress log, TaskCreate usage)

## Environment

- Windows 11, PowerShell + Git Bash both available
- Node via nvm-windows (many node processes running; don't kill them arbitrarily)
- Working dir: `D:\projects\nextjs\bug-bounty-finder`
- Vercel CLI **not** installed globally — user should `npm i -g vercel` when ready to deploy
- `.env` is user-managed; do not read it (contains secrets)

## Files that document the project

| File | Purpose |
|---|---|
| `PLAN.md` | Feature plan + progress log |
| `architecture.md` | System shape, stack decisions, data flow |
| `rules.md` | Project-specific coding rules |
| `phases.md` | MVP → Phase 4 roadmap |
| `design.md` | Design tokens, components, layout patterns |
| `memory.md` | This file — persistent context |

## Session resumption checklist

1. Read `PLAN.md` progress log — where did we leave off?
2. Read `phases.md` current phase checklist — what's the next task?
3. Skim `rules.md` if writing new code
4. Only touch `design.md` tokens/components if changes are cross-cutting
