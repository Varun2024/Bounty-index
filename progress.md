# progress.md

Session-by-session log of what shipped, why, and what's next.

Complement to:
- `ROADMAP.md` — what's queued
- `moat.md` — retention strategy
- `PLAN.md` — original MVP scope + kickoff-era log
- `BRUTAL_REVIEW.md` — strategic assessment

New entries at the top. One entry per shipped feature or notable decision. Keep tight — one paragraph max.

---

## Current phase

**Moat "ship first" — Phase 2 of 4 next: saved filter sets.**

Phase list:
- ~~**P1** `/whats-new` daily changelog + RSS~~ — shipped
- **P2** Saved filter sets — ~2 days
- **P3** Personal notes per program — ~2 days
- **P4** Program lifecycle chart — ~3-4 days

---

## 2026-08-09 — P1: `/whats-new` daily changelog + RSS

`getRecentChanges(hoursBack, limit)` in `lib/db/queries.ts` walks per-program snapshot pairs and emits non-empty diffs where the current side falls inside the window. Sparse snapshots (only written on hash change) mean every snapshot in the window IS a change, so we just need each paired with its predecessor.

`/whats-new` page groups by day, matches the `/feed` layout, shows `+N added / −M removed / reward change / safe-harbor change` per entry with a sample of the actual identifiers. `/whats-new.xml` RSS mirrors it, one `<item>` per diff. Defaults to a 7-day window (168h) — quiet-day-proof. `?hours=24` narrows to yesterday only.

Top nav swap: `/feed` (new programs) → `/whats-new` (scope changes). `/feed` stays reachable from the footer. Sitemap updated.

This is the moat A1 pick and the roadmap's `/feed/scopes` line — same idea, shipped under a friendlier name.

---

## 2026-08-09 — README as a product page

`a6633f9` — Rewrote README with hero screenshot, PH + LaunchLeague badges, screenshots gallery (`/programs`, `/scope-lookup`, program detail), refreshed bbradar comparison, Shipped/Next/Later/Never roadmap. Repo now reads as a product page instead of a dev README.

## 2026-08-09 — Per-program scope-change RSS (moat foundation)

`765b715`, `77114d2` — Every program page now has an RSS feed at `/rss/programs/{platform}/{slug}`. One `<item>` per non-empty snapshot diff (scope added/removed, reward change, safe-harbor change). `<link rel="alternate">` for feed-reader autodiscovery, visible `RSS` anchor on the page.

Free version of what bbradar Pro gates. This is the RSS-only notification story we committed to when killing email alerts. Fix commit moved the route out of `[...slug]/` because Next disallows segments after a catch-all.

## 2026-08-09 — Immunefi cron short-circuit

`c53d99f` — Stage-1 hash of program-level fields stored in `programs.raw.stage1Hash`. On next run, programs whose landing-page fields haven't changed skip both the Stage-2 detail fetch and the persist block. First run still ~410s; subsequent quiet runs finish in seconds and fit inside Vercel Hobby's 300s function cap.

## 2026-08-09 — Product Hunt badge in footer

`e7845b2` — PH badge above LaunchLeague badge in the footer. Same `mt-4 block w-fit focus-ring rounded` pattern to keep the footer rhythm.

## 2026-08-08 — Immunefi Stage 2: per-program scopes

`212f7cd` — For each of the 181 Immunefi programs, fetch `/bug-bounty/{slug}/information/` and extract the `assets[]` array. 2,906 scope entries total. Concurrency capped at 6. Normalized asset types map onto our existing enum. Delete+insert per program to keep scope state clean.

## 2026-08-08 — Immunefi platform coverage (Stage 1)

`9bc9a24` — 181 programs indexed via HTML scrape of the Immunefi landing page. Top payout: LayerZero at $15M. Own scraper because they're not in `arkadiyt/bounty-targets-data`. Platform count 5 → 6. This is the first "we scrape upstream directly" moment — permanent maintenance debt accepted.

## 2026-08-08 — Company logos + 7-day activity chip

`e9eda6c` — Program detail hero now shows a real company favicon (Google's s2/favicons at 128px) instead of the platform-only dot. Meta row now shows `+N −M · 7d` when the program has actual scope movement in the last week. Both use existing snapshot data — no new infra.

## 2026-08-08 — Roadmap refresh after bbradar analysis

`d0c2949` — Rewrote `ROADMAP.md` Now/Next/Later after walking through bbradar.io. Locked in the strategic posture: free versions of what they gate + widen coverage where they own niches + keep the UX edge. Full analysis saved to memory in `project-competitive-bbradar.md`.

---

## Earlier

Older progress lives in `PLAN.md`'s progress log (kickoff era → launch). This file starts from post-launch iteration.
