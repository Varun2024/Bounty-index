# Plan: Discord alerts v2 — filter subscriptions + digest

The v1 plan (`PLAN_DISCORD.md`) parked these as "v2 candidates, do not scope now" and set the
trigger: ship v2 once Discord has real traction. It does (see `[[project-discord-traction]]`), and
the setup-friction fixes (un-gate, pre-save test, bulk subscribe) are in. This scopes v2.

Reference: `PLAN_DISCORD.md` (v1 design, corners, the SSRF/auth rails that carry over unchanged).

---

## What v2 is

v1 is a **bookmark-pinger**: you subscribe programs you already know, one webhook row per program.
It can't tell you about anything you haven't already found. v2 makes it a **market radar**:

- **Filter subscriptions** — "ping me on any newly-paying wildcard", "any HackerOne program that
  gains safe harbor", "anything in web3 scope that changes". The subscription is a *predicate*, not
  a fixed program.
- **New-program alerts** — the same predicate, matched against programs first seen this run. First-
  mover advantage the day a program launches. Falls out of filter-subs for free.
- **Digest mode** — one message per webhook per run summarizing all matches, instead of N embeds.

Only bbradar gates this kind of alerting (Pro tier). We do it free. It leverages the data moat
directly: we see new programs and scope changes first.

## Why filter-subs and digest are coupled (not optional)

A filter-sub fans out. One "any newly-paying program" sub can match dozens of diffs on a big ingest
day. v1's per-program delivery (`deliver-discord.ts`) POSTs one embed per match with a 50ms per-URL
sleep. At 100 matches that's 5s+ of sleeps for a single webhook, and many filter-subs across many
users would blow the **Vercel 300s cron cap**. Digest collapses a webhook's matches for the run into
**one** POST. So digest is the delivery mode for filter-subs, not a nice-to-have. Per-program v1 subs
keep their one-embed-per-change behavior (low fan-out, already bounded).

---

## Data model

New table, independent from `discord_webhooks` (per-program subs stay as they are).

```sql
CREATE TABLE discord_filter_subs (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  webhook_url       TEXT NOT NULL,          -- validated to discord.com/discordapp.com hosts (same rail as v1)
  label             TEXT,
  filter_json       JSONB NOT NULL,         -- structured ProgramFilters: { platform?, minReward?, assetType?, safeHarbor? }
  new_only          BOOLEAN NOT NULL DEFAULT FALSE, -- only fire on first-seen programs, not scope changes
  last_delivered_at TIMESTAMPTZ,            -- idempotency across cron retries
  broken_at         TIMESTAMPTZ,            -- 401/404, same handling as v1
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX discord_filter_subs_active_idx ON discord_filter_subs (id) WHERE broken_at IS NULL;
```

- `filter_json` stores the **structured `ProgramFilters`** (the shape `listProgramsDb` already
  consumes), not the raw `/programs?…` query string. Serialize the current filter / a saved filter
  to `ProgramFilters` at create time. No re-parsing ambiguity at delivery.
- Digest is the only mode for filter-subs in v2; no per-sub mode column yet (add `mode` later if an
  instant option is wanted).
- `platform` is still a plain text column, so no enum migration. This is one `CREATE TABLE`.

## Matching (reuse the existing query builder)

Do **not** hand-roll predicate evaluation. Extend `ProgramFilters` with an optional `ids?: number[]`
and add `ids?.length ? inArray(programs.id, ids) : undefined` to the `listProgramsDb` WHERE
(`queries.ts:104-148`). Then per run:

1. Collect `changedIds` (programs with a non-empty diff this run) and `newIds` (programs with
   `firstSeenAt > sinceTime`). These come from the snapshot pass the cron already does.
2. For each active filter-sub, run one query: programs matching `filter_json` AND
   `id IN (new_only ? newIds : changedIds ∪ newIds)`. One query per sub; subs are few.
3. The returned programs are the sub's matches for this run.

Correctness rides on the same WHERE builder the `/programs` page uses, so a sub matches exactly what
the user would see on the site with that filter. No drift between "what I subscribed" and "what I'd
browse".

## Delivery + digest

In a new `lib/ingest/deliver-filter-alerts.ts` (sibling to `deliver-discord.ts`):

- Group matches by `webhook_url`. For each URL, build **one digest embed**: a title line
  ("N programs matched your filter"), up to ~10 program lines (name · platform · what changed /
  "new"), and "+X more" + a link to the matching `/programs?…` view. Color: emerald.
- POST once per URL. Update `last_delivered_at`; mark `broken_at` on 401/404; leave retryable
  (5xx/429/network) for the next run. Same result-handling as v1 `postDiffToWebhook`.
- Idempotency: skip a sub whose `last_delivered_at >= thisRunCapturedAt`.

**Cron budget:** ≤ (number of distinct filter-sub webhook URLs) POSTs per run, each one message. Even
at hundreds of subs that's seconds, comfortably inside 300s. This is the whole reason digest exists.

Wire into the cron tail after the existing `deliverDiscordAlerts(sinceTime)`:
`await deliverFilterAlerts(sinceTime)`.

## Corners (carry the v1 rails, plus new ones)

- **SSRF / auth** — `webhook_url` validated to Discord hosts; create/test actions auth-gated. Same
  non-negotiable rail as v1. No change.
- **Over-broad filters** — an empty `filter_json` would match everything. Reject a sub whose filter
  has zero constraints at create time (must set at least one of platform / minReward / assetType /
  safeHarbor, or `new_only`). Prevents a firehose.
- **Cap** — soft 10, hard 25 filter-subs per user (lower than per-program's 100; each is a fan-out).
- **Digest size** — cap programs listed in one embed (~10) + "+X more"; Discord embed description
  limit is ~4096 chars, stay well under.
- **Idempotency** — `last_delivered_at` guard, same as v1.
- **Broken webhooks** — `broken_at` on 401/404, UI fix-me chip, no further attempts.

---

## Phases

**P1 — model + create/manage (no delivery yet).**
- `discord_filter_subs` table + `db:push`.
- `ProgramFilters.ids` passthrough in `listProgramsDb` (needed by P2, harmless now).
- Server actions: `addFilterSub`, `listMyFilterSubs`, `removeFilterSub` (auth-gated, validate URL,
  reject empty filter, enforce cap).
- UI: a "filter subscriptions" section on `/settings/discord`; a "get these as a Discord alert"
  entry from `/programs` current filter + from a saved filter. Create with a pasted URL (reuse the
  pre-save test button).
- Verifiable on its own: create / list / remove a sub. Does **not** fire yet — say so in the UI
  ("next ingest will start delivering").

**P2 — delivery + digest.**
- `lib/discord.ts`: `formatDigestEmbed(matches, ctx)` + self-check (pure, testable like the v1
  embed formatter).
- `lib/ingest/deliver-filter-alerts.ts`: match per sub, group by URL, one digest POST per URL,
  idempotent, broken handling.
- Cron integration. Verify against a real webhook with a forced small ingest before claiming done.

**P3 — polish (only if P1/P2 land well).**
- `new_only` UI toggle (new-program alerts as a first-class choice).
- Optional per-sub instant mode (`mode` column) if digest proves too coarse.
- Matching `/programs?…` deep-link in the digest.

## Success criteria

- 10+ filter-subs created within a week of shipping P2.
- Digest keeps the cron delivery step under ~30s even on a high-churn day (measure in the cron
  report).
- At least one "this caught a program the day it launched" signal (Reddit / X / issue).

If filter-subs see little use but per-program stays high, people want precision not radar — stop at
P1 and don't build the matching engine.

## Explicitly not in v2

- No Slack / Telegram (still Discord-first; revisit via the same delivery abstraction).
- No slash-command bot (still gated on ~100 servers: OAuth + hosted process + verification).
- No per-sub schedule / quiet hours. One digest per ingest run, take it or leave it.
- No arbitrary boolean filter logic (AND of the existing dimensions only, matching the `/programs` UI).

## Decision log

- 2026-10-27: Scoped v2 after the setup-friction fixes shipped and Discord became the top surface.
  Chose to reuse the `/programs` `ProgramFilters` WHERE builder for matching (no parallel predicate
  engine), store filters as structured JSON not query strings, and make digest the mandatory
  delivery mode for filter-subs (cron-budget driven). Phased: model → delivery → polish.
