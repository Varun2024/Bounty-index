# Plan: Rich Program Detail Page + MCP Server

Two related workstreams. The MCP surface should mirror the detail-page data model — one canonical shape per program, exposed to humans (UI) and agents (MCP).

Reference:
- Detail page inspiration: https://hackerone.com/palantir_public?type=team
- MCP inspiration: https://genbounty.com/bug-bounty-for-ai-agents

---

## Part 1 — Rich program detail page

### What HackerOne's palantir_public actually shows

1. Header: logo, name, tagline, "Managed" badge, official link
2. Response efficiency: first-response, triage, bounty, resolution, program-age
3. Reward table by severity (Critical / High / Medium / Low with min–max USD)
4. In-scope table: identifier, asset type, eligible-for-bounty, severity, notes
5. Out-of-scope list
6. Program policy (long-form markdown)
7. Hall of thanks / top hackers
8. Announcements / activity feed
9. Guidelines & disclosure policy
10. Submission form *(not our problem — belongs on the platform)*

### What we already have

- Header block: `programs.{name, platform, url, programType, managed, offersBounty, offersSwag}`
- Reward range (aggregate): `programs.{minBounty, maxBounty, currency}`
- Safe-harbor: `programs.safeHarbor`
- Scope (in + out, per-asset severity, per-asset eligibility, notes): `scopes` table — already rich, we just underuse it on the page
- Program age + timeline: `programs.firstSeenAt` + `program_snapshots` (already powers lifecycle chart)
- Response metrics: `user_reports` (community) — median first-response is live
- Change history: `program_snapshots` diffs

### Gaps (what we're missing vs. H1)

| Field | Source | Cost | v1? |
|---|---|---|---|
| Reward per severity | Not in bounty-targets-data. Would need per-platform scrape. | High | ❌ skip — show aggregate range with "per-severity not published" |
| Long-form policy | Scrape platform page. | Medium (fragile) | ❌ skip — link out to official page |
| Hall of fame | Scrape. | Medium | ❌ skip |
| Announcements | Scrape. | Medium | ❌ skip |
| Platform-native response metrics | H1 GraphQL, others don't publish. | High + fragile | ❌ keep community reports as our answer |
| Similar programs | Scope-identifier overlap query on our data. | Low | ✅ include (also unlocks C3) |
| Recent changes for this program | Diff last N snapshots. | Low | ✅ include |

### v1 detail page (already at `/programs/[platform]/[...slug]`)

Sections, top to bottom:
1. **Header** — logo, name, platform, type badges (Bounty/VDP, Managed, Safe-harbor), reward-range, "First seen" age, watch button, official link
2. **At-a-glance** — 4 tiles: median first-response (community), scope counts (in/out), asset-type mix, last change detected
3. **Scope** — existing tables, but enrich: sortable, filter by asset type, "copy identifier", "in Burp scope pattern" copy button
4. **Timeline** — existing lifecycle chart (already shipped C2)
5. **Recent changes** — text diff list from last 5 snapshots ("scope +2, -1 on 2026-08-20")
6. **Community reports** — existing C1 block
7. **Similar programs** — 5 programs sharing the most scope identifiers (implements C3-lite)
8. **Raw** — collapsed JSON of `programs.raw` for power users
9. **Deep-link out** — big "Open on {platform}" CTA to submission page

Skipped: per-severity reward table, policy body, hall of fame — noted with "not aggregated; see official page".

Effort: ~2 days. Mostly wiring existing data + Similar-Programs query.

---

## Part 2 — MCP server (`bounty.index` MCP)

Goal: an autonomous hunting agent connects to `bountyindex.in/mcp` and can complete a full workflow — discover programs, check if a URL is in scope, watch programs, take notes — without a browser.

### Agent user-stories → tool list

Grouped by what a hunter-agent needs to do.

**Discovery (unauthenticated, public data)**

| Tool | Inputs | Returns |
|---|---|---|
| `search_programs` | query, platform[], programType[], offersBounty, safeHarbor, minReward, assetType[], limit, cursor | array of program summaries + cursor |
| `get_program` | platform + slug OR programId | full program payload (matches detail-page schema) |
| `list_scope` | programId, in_scope?, assetType?, eligibleForBounty? | scope rows |
| `scope_lookup` | url or identifier | programs whose scope matches (wildcard-aware; already have `/scope-lookup` route) |
| `list_platforms` | — | platform list + counts |
| `whats_new` | since (ISO ts), types[]: added/removed/scope_changed/reward_changed | change events |
| `similar_programs` | programId, limit | ranked by scope overlap |
| `program_timeline` | programId | snapshot timeline events |

**Personalization (auth required — OAuth via Auth.js, MCP bearer token)**

| Tool | Inputs | Returns |
|---|---|---|
| `list_watchlist` | — | user's watched programs |
| `watch_program` / `unwatch_program` | programId | ok |
| `list_notes` | — | all notes |
| `get_note` / `upsert_note` / `delete_note` | programId, content? | note |
| `list_saved_filters` / `save_filter` / `delete_saved_filter` | name, query | saved filter |
| `report_response_time` | programId, submittedAt, firstResponseAt?, comment? | ok (writes `user_reports`) |

**Feed / streaming**

- `whats_new` polled by agents. Skip SSE/WebSocket in v1 — RSS already exists at `/whats-new.xml`; agents can poll every N minutes cheaply.

### Transport + hosting

- **Streamable HTTP** MCP transport, **stateless mode** (no session store, no KV, no Redis — zero add-on cost on Hobby).
- Serve at `POST /api/mcp` inside the Next.js app on Vercel Fluid Compute. No separate service.
- Library: `@vercel/mcp-adapter` (Apache-2.0, free). Thin wrapper over our existing DB query functions.
- Read-only tools: open, no auth. Per-IP soft rate limit via Next.js middleware (in-memory LRU — no Upstash/KV).
- Write tools: bearer token — issued from a "Create MCP token" page in the signed-in dashboard, stored as a new `user_mcp_tokens` table (`userId`, `tokenHash`, `name`, `createdAt`, `lastUsedAt`, `revokedAt`).
- Public landing page at `/mcp` (public beta) with connection URL, tool list, quickstart snippets for Claude Desktop / Cursor / Codex.

### Fallback behaviour

Same upstream-mirror fallback we shipped for `/programs` and `/scope-lookup` must cover MCP read tools when Neon is down. Auth'd write tools return a clear error when DB is down (no fallback for user state).

### v1 scope (ship-first cut)

Public read tools only + one client-side `manifest`:
- `search_programs`, `get_program`, `list_scope`, `scope_lookup`, `whats_new`, `similar_programs`, `program_timeline`, `list_platforms`

Everything auth'd (`watch_program`, notes, saved filters, response reports) → v1.1 after v1 lands and we validate MCP client compatibility.

Effort estimate:
- v1 read-only MCP: ~2 days (SDK wire-up + 8 tool handlers over existing DB fns).
- v1.1 auth'd tools + token dashboard: ~2 days.

---

## Sequencing

1. **Detail page v1** — 2 days. Unlocks C3-lite (similar programs) and gives MCP `get_program` a canonical payload to return.
2. **MCP read-only v1** — 2 days. Directly reuses detail-page query functions.
3. **MCP auth'd v1.1** — 2 days. Adds `user_mcp_tokens` table + dashboard page.
4. **Then A2** ("newly paying" filter) or another high-impact roadmap item.

Total to fully-agent-capable: ~6 days across 3 shippable increments.

---

## Decisions locked

1. Public beta on `/mcp` landing page from day one.
2. Rate limit shipped in v1 — in-memory per-IP LRU in middleware, no external store.
3. `get_program` accepts `include_raw` flag, default `false`, opt-in `true` returns `programs.raw`.
4. Transport: `@vercel/mcp-adapter` stateless Streamable HTTP. Zero paid add-ons. Runs on Hobby plan within existing function budget.

---

## Not in scope

- Per-severity reward tables (data doesn't exist upstream).
- Scraping platform policy pages (fragile, low ROI, link out instead).
- Any submission-side workflow (that's the platform's job).
- SSE/WebSocket subscriptions (RSS covers polling; add if agents ask).
