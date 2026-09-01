# progress.md

Session-by-session log of what shipped, why, and what's next.

Complement to:
- `ROADMAP.md` — what's queued
- `moat.md` — retention strategy
- `PLAN.md` — original MVP scope + kickoff-era log
- `BRUTAL_REVIEW.md` — strategic assessment

New entries at the top. One entry per shipped feature or notable decision. Keep tight — one paragraph max. Each entry ends with a **For blog:** one-liner naming the angle worth writing about (not a summary — the hook).

---

## Current phase

**Moat P1–P4 + C1 shipped, followed by a codebase cleanup pass.** Next candidates: coverage expansion (Huntr / HackenProof-return), distribution (E1 Chrome extension or E2 Burp plugin), or growth loop (Reddit / X posts seeding C1 reports — drafts already written this session).

Phase list:
- ~~**P1** `/whats-new` daily changelog + RSS~~ — shipped
- ~~**P2** Saved filter sets~~ — shipped
- ~~**P3** Personal notes per program~~ — shipped
- ~~**P4** Program lifecycle chart~~ — shipped
- ~~**C1** Community response-time tracking~~ — shipped
- ~~Refactor pass (4 items)~~ — shipped

---

## 2026-09-01 — MCP server v1 (read-only, public beta)

Shipped `POST /api/mcp` via `mcp-handler` (Apache-2.0; the successor to `@vercel/mcp-adapter`) in stateless Streamable-HTTP mode. Zero paid add-ons, no KV, no session store. Eight public tools: `search_programs`, `get_program`, `list_scope`, `scope_lookup`, `whats_new`, `similar_programs`, `program_timeline`, `list_platforms` — all reusing the same fallback-wrapped query functions the web UI runs, so the MCP surface stays live during Neon quota outages the same way `/programs` does. `get_program` takes an `include_raw` flag (default false).

Rate limit via `proxy.ts` (Next 16's replacement for `middleware.ts`): in-memory per-IP LRU, 60 req/min, keyed off `x-forwarded-for`. Ponytail-commented for a KV upgrade path if abuse actually shows up. Public beta landing at `/mcp` with the connection URL, tool list, and paste-in snippets for Claude Desktop and Cursor.

Smoke-tested end-to-end: `initialize` returns the handshake, `tools/list` emits well-shaped JSON Schemas for all 8 tools, and `tools/call` on `search_programs` returned real Shopify + CBRE rows via the upstream mirror (Neon was still in its August quota window).

**For blog:** what "MCP for your product" actually looks like when it mirrors the same query layer your UI uses --- and shipping it on Vercel Hobby with zero external state.

---

## 2026-08-31 — Rich program detail page + MCP plan

`c5e6bcb` — v1 pass on the program detail page using data we already store, no new ingest. Four new sections: **AtAGlance** tiles (median first-response from community reports, scope split, top asset-type mix, last-change age); **RecentChanges** walking the existing snapshot array for the last 5 non-empty diffs; **SimilarPrograms** via a new `getSimilarPrograms` query ranking by count of shared in-scope identifiers (fails open); **CopyScope** client button that dumps newline-separated in-scope identifiers to clipboard for paste into Burp/Caido/whatever. Raw source payload collapsed into a `<details>` at the bottom. Skipped per plan: per-severity reward tables (not in upstream data), policy body (fragile scrape, link out), hall of fame.

Also wrote `PLAN_MCP_AND_DETAIL.md` locking the follow-on: MCP server at `POST /api/mcp` via `@vercel/mcp-adapter` in stateless Streamable-HTTP mode. Zero paid add-ons — no KV, no Redis. Public beta at `/mcp` from day one, per-IP rate limit in v1, `include_raw` flag on `get_program`. Read-only v1 = 8 tools reusing the same query functions the detail page uses. Auth'd v1.1 adds a `user_mcp_tokens` table + a dashboard page for token issuance.

**For blog:** how much richer a detail page you can build with data you already store — the ingest is done, the UI just wasn't asking hard enough questions yet. And: what "MCP for your product" actually looks like when it mirrors the same query functions your UI already runs.

---

## 2026-08-10 — Refactor pass (4 items)

Cleanup after 6 features in 2 days. Zero behavior change; four commits, one per item.

- `9fb2352` — extracted `requireUserId` to `app/actions/require-user.ts`. Three inline copies gone.
- `9d40a27` — split `app/actions/sync.ts` into per-domain modules (`sync-watchlist.ts`, `sync-compare.ts`, `sync-saved-filters.ts`). Bridge (`syncOnSignIn`) stays in `sync.ts`. Client stores import from the matching per-domain file.
- `f180a90` — extracted `SectionHeading` primitive in `app/_ui/`. Migrated ScopeColumn / ProgramTimeline / ProgramNotes / CommunityReports.
- `79ebd11` — split the 555-line program detail page. `page.tsx` 555 → 242. Extracted `scope-columns.tsx` (193) and `timeline.tsx` (129). Cleaner ground for the next batch of per-program features.

Held (speculative for now): unified `useSyncedList<T>` hook across watchlist/compare/saved-filters (signatures differ enough that the abstraction obscures more than it clarifies), design-token module, `_ui/primitives/` layer for stat pills / legend dots (only 2–3 instances each).

**For blog:** when to reach for a refactor pass vs. keep shipping — and the equally important skill of *not* extracting an abstraction because signatures differ.

---

## 2026-08-10 — C1: Community response-time tracking

## 2026-08-10 — C1: Community response-time tracking

New `user_reports` table (userId + programId composite PK, submittedAt, firstResponseAt nullable, comment nullable, timestamps). One row per (user, program) — resubmission via `onConflictDoUpdate`. Aggregates are public (median first-response days + count + waiting count); individual rows are never exposed to other users. This is the moat C1 pick — peer-sourced trust data platforms won't publish.

Server actions in `app/actions/reports.ts`: `submitReport`, `deleteReport`, `getUserReport(programId)`, `getProgramReportStats(programId)`. Median computed via Postgres `percentile_cont(0.5) within group` filtered to non-null first-response rows. Suppressed when fewer than 3 answered reports exist — small-N medians are noise. Date validation: no future dates, no dates older than 5 years, first-response ≥ submitted.

`CommunityReports` client component on the program detail page renders the aggregate stats grid (median, waiting count) or an empty state prompting first report. "+ report your times" button opens a native `<dialog>` form: submitted date (required), first response date (optional — leave blank if still waiting), optional 120-char comment. Signed-out users get bounced to GitHub OAuth. Existing report shows update + delete affordances.

Types + constants in `lib/reports.ts` (same 'use server' lesson as notes.ts). Slotted into program detail between the scope columns and personal notes — it's quality signal that belongs alongside scope when evaluating a program.

Chicken-and-egg concern: with zero reports, this section is a call-to-action, not data. Empty state is designed to invite the first submission. As reports accumulate, the section becomes real intel. Nothing to do about the seeding curve except ship it and let the audience contribute.

**For blog:** shipping a community-data feature with a seeding curve — how to design the empty state as a call-to-action, and why you ship the moat before the data exists.

---

## 2026-08-10 — P4: Program lifecycle chart

## 2026-08-10 — P4: Program lifecycle chart

`LifecycleChart` component in `app/programs/[platform]/[...slug]/lifecycle-chart.tsx` — pure server-render SVG, no chart library, ~180 lines. Renders an in-scope-count-over-time line + area for the full snapshot history on each program detail page. Point dots are colour-coded by event kind: neutral for the baseline snapshot, emerald for scope additions, amber for removals, cyan for reward changes. Native `<title>` on each point provides the hover tooltip (date · count · event kind) — no client JS needed.

Left axis shows the y-max tick (peak in-scope count with 15% headroom) and 0 baseline. Bottom axis shows first and last snapshot dates. A subtitle line above the chart reports duration in days and the peak count. Legend beneath. Only rendered when a program has ≥ 2 snapshots; single-snapshot programs still get the existing "// only one snapshot on record" hint.

Slotted inside the existing "History" section above the event list so chart-plus-list feels like one artifact. Chart gets more valuable per day as snapshot history compounds — this is the moat pitch codified: "we've been snapshotting daily for months, look at the story of this program."

**For blog:** zero-JS SVG charts in React server components — 180 lines, no chart library, native `<title>` tooltips. Also: shipping features whose value compounds with time.

---

## 2026-08-10 — P3: Personal notes per program

## 2026-08-10 — P3: Personal notes per program

New table `user_notes` (userId, programId, content, updatedAt) with a composite PK. Signed-in only — deliberately no localStorage fallback because the whole point of moat B2 is account-tied lock-in (see moat.md). Server actions in `app/actions/notes.ts`: `getNote(programId)`, `saveNote(programId, content)`. Empty content deletes the row to keep the table lean.

`ProgramNotes` client component slotted into the program detail page between the scope columns and the timeline. Textarea with autosave (800ms debounce) + flush on blur. Char counter (max 5000, colour shifts amber past 95%). Status pill shows "saving…", "saved 3s ago", or "save failed" — falls back to relative time when idle. Signed-out state renders a dashed sign-in prompt instead of the textarea.

Constants + types moved to `lib/notes.ts` because `'use server'` files can only export async functions — learned that the hard way on first build.

Also fixed in this session: search icon in the filters rail was centering on the wrong container (the wrapper included the helper `<p>`), tightened the wrapper to input-only (`1cd820e`). Highlighted several buried tokens in muted secondary text — 'show N more' counter, '/whats-new' window label, safe-harbor coverage note.

**For blog:** the "`use server` files can only export async" gotcha that only surfaces on production build — and the lock-in argument for skipping localStorage on account-tied features.

---

## 2026-08-10 — P2: Saved filter sets

New table `user_saved_filters` (id, userId, name, query, createdAt) with a unique index on (userId, name) so save-with-existing-name is idempotent. Server actions mirror the watchlist pattern: `getServerSavedFilters`, `addServerSavedFilter`, `removeServerSavedFilter`, `mergeServerSavedFilters`. Cap of 20 per user, name max 40 chars, query max 500 chars.

Client store `lib/saved-filters.ts` follows watchlist's `useSyncExternalStore` shape. localStorage-only for signed-out users (with client-generated string ids). `AuthSync` extended to merge saved filters on sign-in — the sign-in bridge now handles all three lists (watchlist, compare, saved filters) in one round-trip via `syncOnSignIn`.

UI: new `SavedFiltersSection` component slotted into the filters rail right after the search input. Lists saved filter sets with active-state highlighting when the current URL matches. Empty state prompts users to save the current combo. When active filters are applied and not already saved, a dashed "+ save current filter" button appears. Save flow uses `window.prompt` — MVP-appropriate; can move to an inline form later if the feature gets traction.

**For blog:** URL as state, plus named presets on top. Building a shareable-filter primitive without a client store, and merging localStorage → server on sign-in.

---

## 2026-08-09 — Compact identifier display + collapsed long scope lists

`89e847f` — `shortenIdentifier()` strips URL protocol, collapses long hex/base58 address middles to first…last windows, caps display length at 64 chars. Full identifier stays in tooltip + href. Scope lists show the first 10 rows inline; anything beyond gets wrapped in a native `<details>` disclosure. No client JS — pure CSS `:open` state.

**For blog:** truncating URLs and blockchain addresses for scan-ability without hiding the value — and how much you can do with native `<details>` before reaching for a JS disclosure lib.

## 2026-08-09 — P1: `/whats-new` daily changelog + RSS

`getRecentChanges(hoursBack, limit)` in `lib/db/queries.ts` walks per-program snapshot pairs and emits non-empty diffs where the current side falls inside the window. Sparse snapshots (only written on hash change) mean every snapshot in the window IS a change, so we just need each paired with its predecessor.

`/whats-new` page groups by day, matches the `/feed` layout, shows `+N added / −M removed / reward change / safe-harbor change` per entry with a sample of the actual identifiers. `/whats-new.xml` RSS mirrors it, one `<item>` per diff. Defaults to a 7-day window (168h) — quiet-day-proof. `?hours=24` narrows to yesterday only.

Top nav swap: `/feed` (new programs) → `/whats-new` (scope changes). `/feed` stays reachable from the footer. Sitemap updated.

This is the moat A1 pick and the roadmap's `/feed/scopes` line — same idea, shipped under a friendlier name.

**For blog:** turning sparse snapshot history into a daily changelog + RSS in one query. Also: why RSS beats email alerts for retention on a solo project.

---

## 2026-08-09 — README as a product page

`a6633f9` — Rewrote README with hero screenshot, PH + LaunchLeague badges, screenshots gallery (`/programs`, `/scope-lookup`, program detail), refreshed bbradar comparison, Shipped/Next/Later/Never roadmap. Repo now reads as a product page instead of a dev README.

**For blog:** your README is your first product page — how to rewrite it to sell, not to document.

## 2026-08-09 — Per-program scope-change RSS (moat foundation)

`765b715`, `77114d2` — Every program page now has an RSS feed at `/rss/programs/{platform}/{slug}`. One `<item>` per non-empty snapshot diff (scope added/removed, reward change, safe-harbor change). `<link rel="alternate">` for feed-reader autodiscovery, visible `RSS` anchor on the page.

Free version of what bbradar Pro gates. This is the RSS-only notification story we committed to when killing email alerts. Fix commit moved the route out of `[...slug]/` because Next disallows segments after a catch-all.

**For blog:** the "free what your competitor gates" move — and a small Next.js catch-all routing trap along the way.

## 2026-08-09 — Immunefi cron short-circuit

`c53d99f` — Stage-1 hash of program-level fields stored in `programs.raw.stage1Hash`. On next run, programs whose landing-page fields haven't changed skip both the Stage-2 detail fetch and the persist block. First run still ~410s; subsequent quiet runs finish in seconds and fit inside Vercel Hobby's 300s function cap.

**For blog:** fitting a 400s scrape inside Vercel Hobby's 300s function cap with a content-hash short-circuit — the pattern for any incremental sync job.

## 2026-08-09 — Product Hunt badge in footer

`e7845b2` — PH badge above LaunchLeague badge in the footer. Same `mt-4 block w-fit focus-ring rounded` pattern to keep the footer rhythm.

**For blog:** *(minor cosmetic ship — no blog angle worth writing)*

## 2026-08-08 — Immunefi Stage 2: per-program scopes

`212f7cd` — For each of the 181 Immunefi programs, fetch `/bug-bounty/{slug}/information/` and extract the `assets[]` array. 2,906 scope entries total. Concurrency capped at 6. Normalized asset types map onto our existing enum. Delete+insert per program to keep scope state clean.

**For blog:** batch-scraping 2,900 pages politely — concurrency caps, delete-and-reinsert for state cleanliness, and mapping foreign taxonomies onto your own enum.

## 2026-08-08 — Immunefi platform coverage (Stage 1)

`9bc9a24` — 181 programs indexed via HTML scrape of the Immunefi landing page. Top payout: LayerZero at $15M. Own scraper because they're not in `arkadiyt/bounty-targets-data`. Platform count 5 → 6. This is the first "we scrape upstream directly" moment — permanent maintenance debt accepted.

**For blog:** when to accept permanent scraper maintenance debt for the sake of coverage — the tradeoff calculus for a solo builder.

## 2026-08-08 — Company logos + 7-day activity chip

`e9eda6c` — Program detail hero now shows a real company favicon (Google's s2/favicons at 128px) instead of the platform-only dot. Meta row now shows `+N −M · 7d` when the program has actual scope movement in the last week. Both use existing snapshot data — no new infra.

**For blog:** two data-free upgrades that made program pages feel alive — the "look at what you already have" audit every product should run.

## 2026-08-08 — Roadmap refresh after bbradar analysis

`d0c2949` — Rewrote `ROADMAP.md` Now/Next/Later after walking through bbradar.io. Locked in the strategic posture: free versions of what they gate + widen coverage where they own niches + keep the UX edge. Full analysis saved to memory in `project-competitive-bbradar.md`.

**For blog:** rewriting your roadmap after studying a direct competitor — how to convert a competitive analysis into a concrete Now/Next/Later.

---

## Earlier

Older progress lives in `PLAN.md`'s progress log (kickoff era → launch). This file starts from post-launch iteration.
