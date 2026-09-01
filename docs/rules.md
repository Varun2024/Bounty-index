# Project Rules

Project-specific rules. Global TypeScript/web rules in `~/.claude/rules/` still apply.

## Code

- **TypeScript strict, no `any`.** Use `unknown` at trust boundaries, narrow with Zod or type guards.
- **Server Components by default.** Only mark `'use client'` when you need state, effects, or event handlers.
- **DB access only from server code.** `lib/db/*` is server-only. Never import into client components.
- **URL is the source of truth for filters.** No client-side filter state. Everything derives from `searchParams`.
- **No component library.** Inline Tailwind. If a pattern repeats 3+ times, extract to `app/_ui/`.
- **No `console.log` in committed code.** Use `console.error` for genuine errors, remove debug logs before commit.
- **Immutable updates only** (spread, not mutation).

## Data

- **Sources are read-only.** We never modify bounty-targets-data or platform APIs; we only re-parse.
- **Keep `raw` JSONB on every program.** Cheap insurance for schema changes.
- **Upserts, not deletes.** Programs are keyed on `(platform, slug)`. If a program disappears upstream, mark it stale rather than deleting (add `is_active` field when this matters).
- **Scopes are replaced wholesale per program per ingest.** Simpler than diffing.
- **`first_seen_at` is set once, never overwritten.**

## Ingest

- **Per-platform failure is isolated.** One platform 500ing doesn't fail the batch.
- **No scraping platform HTML.** bounty-targets-data + official APIs only. Legal + polite.
- **Respect `cache: 'no-store'` on external fetches.** Vercel's fetch cache doesn't help here.
- **Ingest job must be idempotent.** Running it twice produces the same DB state.

## UI

- **Dark mode only** for MVP. It's a hacker tool; the audience wants it.
- **Monospace for identifiers** (domains, slugs, platform names). Sans for prose.
- **Emerald `#34d399` is the only accent.** Used for: interactive state, "in-scope match", "has bounty", primary CTAs.
- **Amber for warnings.** Never red on the main path — red is for errors only.
- **No modals for filter state.** Chips in the left rail, URL-synced.
- **Table default, cards opt-in.** Hackers scan; don't slow them down with card grids.

## Security

- **Never commit `.env`.** Already in `.gitignore`. Confirm before every push.
- **`CRON_SECRET` must be set in production.** The cron endpoint has no other protection.
- **No user input goes into raw SQL.** Drizzle parameterizes everything; keep it that way.
- **`ILIKE` with user input is bounded by page size.** No unbounded queries.

## Git

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- One logical change per commit.
- `PLAN.md` progress log gets an entry when a phase completes.

## When to break these rules

- If a rule is blocking real work, break it and write the reason next to the change with a `// ponytail:` comment naming the ceiling.
- Then bring it up next session so the rule can be updated or removed.
