# bounty.index

**The bug bounty market, live-indexed.**
Every public program across HackerOne, Bugcrowd, Intigriti, YesWeHack, and Federacy — filtered by scope, asset type, and payout, in one view.

**Live:** [bounty-index.vercel.app](https://bounty-index.vercel.app)

---

## Why

Every bug bounty platform shows only its own programs. Directory sites are stale or policy-only. Raw JSON is fine if you enjoy `jq`. This is the one built for scanning.

| Source | Coverage | Sort by payout | Scope lookup | Keyboard nav |
|---|---|---|---|---|
| HackerOne directory | 1 of 5 | severity only | ✗ | ✗ |
| Bugcrowd programs page | 1 of 5 | ✓ | ✗ | ✗ |
| disclose.io | VDP policies only | ✗ | ✗ | ✗ |
| bounty-targets-data | 5 of 5 raw JSON | grep + jq | grep + jq | n/a |
| **bounty.index** | 5 of 5 unified | ✓ | ✓ one query | ✓ `/` `j k` `↵` |

## Features

- **Unified index** — one table, five platforms, sorted by max reward
- **Scope lookup** — paste a domain, get every program it appears in (in-scope only)
- **Filters** — platform, asset type (wildcard, API, mobile, hardware, source), minimum payout
- **Keyboard-first** — `/` focus search, `j`/`k` move rows, `↵` open, `esc` blur
- **Feed** — dated log of newly indexed programs + RSS

## Stack

- **Next.js 16** (App Router, Fluid Compute) + **TypeScript**
- **Tailwind 4** — dark editorial design system, single-accent emerald
- **Neon Postgres** + **Drizzle ORM**
- **Vercel** for hosting, cron, analytics
- Data source: [arkadiyt/bounty-targets-data](https://github.com/arkadiyt/bounty-targets-data) (MIT)

## Local setup

```bash
git clone https://github.com/Varun2024/Bounty-index.git
cd Bounty-index
npm install
cp .env.example .env    # set DATABASE_URL to a Postgres connection string
npm run db:push         # create tables
npm run ingest          # first data pull (~1,100 programs, ~50k scopes)
npm run dev
```

Open [localhost:3000](http://localhost:3000).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run dev:webpack` | Dev server (Webpack fallback for Windows Turbopack issues) |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run db:push` | Push schema to Postgres |
| `npm run db:generate` | Generate SQL migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run ingest` | Re-run the ingest job locally |

## Deployment

Deployed on Vercel with:

- **`DATABASE_URL`** — Neon Postgres connection string
- **`CRON_SECRET`** — random 32-byte hex, used to authenticate the ingest cron
- **`NEXT_PUBLIC_SITE_URL`** — canonical site URL (used by `metadataBase`, sitemap, robots)

Cron runs daily at 06:00 UTC via `vercel.ts` → `/api/cron/ingest` (Bearer-authenticated). Hobby plan is daily-max — upgrade to Pro to switch back to hourly in `vercel.ts`.

## Project structure

```
app/
├─ page.tsx                             Landing (hero + how-it-works + comparison + features + CTA)
├─ layout.tsx                           Root layout (header, footer, global keyboard, analytics)
├─ globals.css                          Design tokens + keyframes
├─ icon.svg                             Favicon (crosshair mark)
├─ programs/
│  ├─ page.tsx                          Index table with chip filters
│  ├─ [platform]/[...slug]/page.tsx     Detail page with split scope columns
│  ├─ filters-rail.tsx                  Sidebar chip filters (desktop)
│  ├─ filter-drawer.tsx                 Bottom-sheet drawer (mobile)
│  ├─ active-filters.tsx                Removable active filter chips
│  ├─ keyboard-nav.tsx                  j/k/↵ row navigation
│  ├─ pagination.tsx                    URL-driven pagination
│  └─ loading.tsx                       Skeleton
├─ scope-lookup/                        Domain → programs verdict search
├─ feed/                                Newest programs (dated log)
├─ feed.xml/                            RSS 2.0
├─ api/cron/ingest/                     Bearer-authed ingest route
├─ robots.ts, sitemap.ts
└─ _ui/                                 Shared UI primitives
   ├─ logo.tsx, icons.tsx               SVG mark + icon set
   ├─ ticker.tsx                        CSS marquee of newest programs
   ├─ tilt.tsx                          3D card tilt (CSS custom properties)
   ├─ global-keyboard.tsx               Global "/" focus shortcut
   └─ skeleton.tsx                      Shimmer loading primitive
lib/
├─ db/
│  ├─ schema.ts, client.ts              Drizzle schema + lazy Postgres client
│  └─ queries.ts                        listPrograms, findByDomain, stats, etc.
├─ ingest/
│  └─ bounty-targets.ts                 Per-platform normalizers → upsert
└─ format.ts                            formatBounty, platformLabel, scopeHref
```

Docs at repo root explain the design decisions:

- `PLAN.md` — MVP scope + progress log
- `architecture.md` — stack, data flow, trust boundaries
- `rules.md` — project-specific coding + design rules
- `phases.md` — Phase 0 → 4 roadmap
- `design.md` — full design system (tokens, patterns, motion)
- `memory.md` — locked decisions + resumption cheatsheet

## Roadmap

Phase 1 (live) — public site, filters, scope lookup, RSS, daily ingest.

**Phase 2 — accounts + alerts:** NextAuth (GitHub OAuth), saved filters per user, email alerts (Resend), Discord webhook alerts, watchlist + private notes, "match my stack" ranking.

**Phase 3 — signal layer:** payout stats from public disclosures, writeup links per program, program change history (payout increases, scope expansions).

Never on the roadmap: paywalls on the core index, ads, fake/sponsored programs.

## License

MIT. Data belongs to the respective platforms. Not affiliated with HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy, or any other platform.
