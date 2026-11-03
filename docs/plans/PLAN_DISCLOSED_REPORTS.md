# PLAN — Disclosed-reports ingestion (real payout / response data)

**Status:** scoped, not started (2026-11-03). **Why it's the highest-leverage moat feature:** the upstream mirror (`arkadiyt/bounty-targets-data`) has *stated* scope + *stated* max payout only. It has **no record of what programs actually pay or how fast they respond.** Disclosed reports are the one public source of *actual* bounty amounts and response times. Ingesting them turns our derived layer from "diffs anyone could compute" into data a forker genuinely cannot reproduce without crawling for months — and it finally fills the P3 gap (we currently show only stated-max ceilings, see `moat.md` honesty rule 9).

Binds to `moat.md` Part 1: append-only forever (rule 1), computed layer query-only never bulk (rule 2), a signal upstream can't have (rule 3), honest confidence labelling (rules 8–9). Minimal footprint — reuse the existing ingest + snapshot discipline, no new deps.

---

## 1. Sources — what's actually scrapable

No platform offers an official public API for this. Every source below is a **public page / the web app's own endpoint**, same posture we already accept for `immunefi.ts` and `hackenproof.ts`. Rank by yield and build in this order:

| Source | What's exposed | Amounts? | Access | Verdict |
|---|---|---|---|---|
| **HackerOne Hacktivity** | Disclosed reports: program (handle), title, severity, disclosure date, upvotes, and bounty amount **when the report discloses it** | Yes, often | Public GraphQL endpoint the Hacktivity UI itself calls (same one `h1grep` and public scrapers use). Cursor-paginated. Not an official API — can change shape. | **Phase 1. Richest source, smallest slice.** |
| **Bugcrowd CrowdStream** | Public activity feed: program, researcher, priority, target, resolved/accepted date, reward amount | Sometimes — **reward visibility is researcher-controlled** (they can hide username and/or amount) | Public HTML/JSON feed pages, no official API | Phase 3. Amounts sparse by design. |
| **YesWeHack** | Program pages show aggregate **report count, first-response time, reports-this-month** | No per-report amounts | Public program pages (we already fetch these) | Phase 3 — use for **response-time** signal, not payouts. |
| **Immunefi** | Publicly published paid bounties (leaderboard / blog) | Yes | We **already scrape Immunefi** (`lib/ingest/immunefi.ts`) — extend it | Phase 3 bonus, low marginal cost. |
| **Intigriti** | Fixed-report disclosure to other users is weak/limited historically | Rarely | — | Skip until it proves to have a real feed. |

**ToS / rate-limit reality (conservative stance):** treat all of this as a gray area. We only touch **publicly disclosed** data any browser can load, we identify ourselves (`User-Agent: bounty.index-ingest/1.0`, same as `hackenproof.ts`), we crawl **slowly and bounded**, we respect `robots.txt`, we **honor researcher choices to hide amounts** (never infer a hidden amount), and we attribute + link back to the source report. If any platform objects, we drop that source — the moat is the accumulated history, not any single live crawl.

**Polite crawl cadence:** piggyback the existing daily cron (`/api/cron/ingest`, `0 6 * * *`) but **decouple the work** — disclosed reports are immutable once disclosed, so we only need to pull *new* ones. Reuse the `hackenproof.ts` bounding pattern exactly: custom UA, `DETAIL_BATCH_SIZE ≈ 6`, `MAX_FETCHES_PER_RUN ≈ 120`, hard page cap. One incremental page-walk per day from the newest cursor until we hit reports we already have; unprocessed backlog rolls to the next tick. No burst, no backfill hammering.

---

## 2. Data to extract (per disclosed report)

- `platform` + `externalId` (report id or canonical URL) — the natural unique key.
- `programHandle` / `programSlug` → map to our `programs.id` by `(platform, handle|slug)`. Store the raw handle too so unmapped reports resolve opportunistically on a later run.
- `title`, `severity` (normalized to our existing severity vocabulary where possible).
- `bountyAmount` + `currency` (**nullable** — null means "not disclosed", never 0).
- `disclosedAt`, and when present: `submittedAt`, `triagedAt` / `firstResponseAt`, `resolvedAt`.
- `researcher` (nullable, only if public).
- `raw` payload (jsonb) for reprocessing without re-crawling.

---

## 3. Derived metrics this unlocks (query-only — fills P3)

Computed in a new `lib/disclosed.ts` (mirrors `lib/opportunity.ts` / `lib/snapshots.ts`), surfaced only through queries — **never a bulk download** (rule 2):

- **Real typical payout** — median (+ p25/p75) of disclosed `bountyAmount` per program. The honest answer to "what does this actually pay", distinct from stated max. **Gated by sample size (see §5):** individual disclosed amounts shown at `N ≥ 3`; a median/percentile aggregate only at `N ≥ 8` — a median over 3–7 points is noise dressed as a statistic.
- **"Actually pays"** — program has ≥1 disclosed paid report. Stronger trust signal than `offersBounty`.
- **"Pays fast"** — median time-to-first-response and/or time-to-resolve.
- **Response-time ranking** / **payout ranking** across programs.
- **Currency-normalized** to USD for cross-program comparison (reuse whatever rate handling exists; else a static table — a `ponytail:` corner, fine for ranking).

---

## 4. Storage (append-only, same discipline as snapshots)

New table `disclosed_reports`, immutable + append-only (no update/delete job, ever — rule 1):

```
disclosed_reports
  id            serial pk
  platform      text not null
  external_id   text not null          -- report id / canonical URL
  program_id    integer fk programs(id) on delete set null   -- nullable; resolved by (platform, handle)
  program_handle text                   -- raw, for later mapping
  title         text
  severity      text
  bounty_amount integer                 -- nullable = not disclosed
  currency      text
  submitted_at    timestamptz
  first_response_at timestamptz
  resolved_at     timestamptz
  disclosed_at    timestamptz not null
  researcher    text
  content_hash  text not null           -- for idempotent re-ingest
  payload       jsonb not null
  captured_at   timestamptz not null default now()
  unique (platform, external_id)
  index (program_id, disclosed_at)
```

Disclosed reports are immutable post-disclosure, so ingest is **insert-if-new** (`onConflictDoNothing` on `(platform, external_id)`) rather than the hash-vs-latest compare `maybeSnapshot` uses for mutable program state. Keep `content_hash` so a corrected re-crawl is detectable but never overwrites history. Derived metrics are **computed on read** (or a cached materialized read tag), never stored as the source of truth.

---

## 5. How it surfaces

- **Program detail page** — a "Real payouts" card near the stated-max key-facts, with a **two-tier threshold** so we never over-claim from thin data:
  - `N = 0`: nothing (or a quiet "no disclosed reports yet").
  - `N ≥ 3`: show the **individual disclosed amounts** (a short list of real reports + their $, severity, date, source link). Honest and verifiable — "here are the N disclosed payouts we found" — without implying it's representative.
  - `N ≥ 8`: additionally show the **median + p25/p75 aggregate** ("typical disclosed payout"). A median below this is noise, so it stays hidden until the sample earns it.
  - Always display `N` and label it "based on N disclosed reports — not all payouts".
- **Programs list** — a new sort/filter axis: **"real payout"** (median disclosed) alongside the existing **"stated max"**. Makes the stated-vs-real distinction a first-class, visible thing — directly answering the P3 critique.
- **Feeds / MCP** — once stable, a `disclosed` field on program reads and an MCP tool ("recent disclosed reports / real payouts"), extending the one-path pattern. Deferred to after UI validates the data.

---

## 6. Risks & how we handle them

- **ToS** — public disclosed data only, identify ourselves, slow + bounded, honor `robots.txt`, honor hide-amount choices, attribute. Drop a source on objection. (See §1.)
- **Data sparsity** — most programs never disclose; many disclosed reports hide the amount. **Mitigation:** the two-tier threshold (§5) — individual amounts only at `N ≥ 3`, a median/percentile aggregate only at `N ≥ 8`; always show `N` and label it "based on N disclosed reports — not all payouts". Never present a single report, or a median over a handful, as "typical".
- **Scraper fragility** — the H1 GraphQL shape can change. **Mitigation:** the same safety the snapshot discipline already gives us — a bad parse is a no-op or one bad row via `onConflictDoNothing`, never a wipe. Alert on a run that inserts zero across a full page-walk (shape likely changed).
- **Currency / severity normalization** — normalize to USD + our severity vocab; a static FX table is an acceptable `ponytail:` corner for ranking.
- **Program mapping gaps** — unmapped reports are stored with the raw handle and resolved on a later run; they never block ingest.

---

## 7. Phased rollout (smallest shippable slice first)

- **Phase 0 — schema only.** Add `disclosed_reports` + Drizzle types. No ingest, no UI. One migration.
- **Phase 1 — H1 Hacktivity ingest, data only.** `lib/ingest/disclosed/hackerone.ts` (bounded page-walk, insert-if-new), wired into the daily cron. Map to programs by handle. **No UI yet** — run it a week, inspect data quality (amount coverage, mapping hit rate, date completeness). This is the go/no-go gate.
- **Phase 2 — detail-page "Real payouts" card.** `lib/disclosed.ts` compute + the card with the two-tier threshold (§5): individual amounts at `N ≥ 3`, median/percentiles at `N ≥ 8`, honest empty state below.
- **Phase 3 — "real payout" sort/filter** on `/programs`, and the **"pays fast"** response-time ranking (needs the time fields to be populated well enough).
- **Phase 4 — more sources.** Bugcrowd CrowdStream (sparse amounts), YesWeHack response-time aggregates, Immunefi paid-bounty extension. Then MCP/feed exposure.

Stop after any phase that doesn't earn its keep. Phase 1's data-quality gate decides whether this is worth the ongoing scraper-maintenance debt (same calculus we accepted for Immunefi).
