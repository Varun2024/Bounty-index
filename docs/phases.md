# Phases

## Phase 0 — Scaffold ✅
- Next.js 16 + Tailwind 4 + TS
- Drizzle + Postgres + Zod deps
- Schema: `programs`, `scopes`, `sources`, `ingest_runs`
- Ingest job for 6 platforms (bounty-targets-data)
- Pages: `/`, `/programs`, `/programs/[p]/[s]`, `/scope-lookup`, `/feed`
- URL-driven filters, dark editorial UI

## Phase 1 — MVP live (current)
**Goal:** Public site that's actually useful for someone hunting bounties.

- [ ] Neon Postgres connected + `db:push`
- [ ] First `npm run ingest` completes
- [ ] Vercel Cron wired to `/api/cron/ingest` (hourly, Bearer via `CRON_SECRET`)
- [ ] `/feed.xml` RSS route
- [ ] Reward range filter (min/max sliders in left rail)
- [ ] Pagination on `/programs` (currently unpaginated below 30)
- [ ] Keyboard shortcuts on `/programs` — `/` focuses search, `j/k` moves selection, `↵` opens
- [ ] Meta tags + Open Graph + `robots.txt` + `sitemap.xml`
- [ ] Deploy to Vercel with production DB
- [ ] Basic Plausible or Vercel Analytics

**Definition of done:** A hacker can visit, filter by "hackerone + wildcard + bounty", find a program, and click through to submit — in under 30 seconds.

## Phase 2 — Accounts + alerts
**Trigger:** ≥ 50 daily unique visitors or repeat traffic from bug-bounty communities.

- [ ] Auth (NextAuth, GitHub OAuth — audience overlaps heavily)
- [ ] Saved filters per user
- [ ] Email alerts on saved-filter matches (Resend)
- [ ] Discord webhook alerts
- [ ] Watchlist + private notes on programs
- [ ] "New programs since I last checked" indicator
- [ ] "Match my stack" — user picks tech tags, ranked programs

## Phase 3 — Signal layer
**Trigger:** Accounts working, users engaging with alerts.

- [ ] Payout stats from public disclosures (Hacktivity, Bugcrowd)
- [ ] Writeup links per program (Pentester Land RSS, Hacktivity)
- [ ] Program change history (payout increases, scope expansions)
- [ ] Response-time estimates where platform data allows
- [ ] Weekly digest email

## Phase 4 — Monetization (only after Phase 3 has retention)
**Not deciding now.** Candidates ranked by fit:

1. **Pro tier** — saved filters > 3, more alert channels, historical data, API access. Stripe.
2. **Job board** — companies with programs pay to feature security roles.
3. **Sponsored program slots** — clearly marked, only for existing programs, never fake ones.
4. **Affiliate** — some platforms have referral programs; low priority.

**Never:** paywalls on the core index, ads, "unlock this program" gates.

## Explicitly skipped forever
- Report submission (liability, out of scope)
- Hacker profiles / gamification (not the point)
- Native mobile app (web works)
- AI vuln suggester (noise, liability)
- Chat/forum (moderation nightmare)
