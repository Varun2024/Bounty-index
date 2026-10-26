# Plan: Huntr coverage — design pass

Design pass requested after the HackenProof coverage ship (2026-10-26). Goal was to decide how
Huntr (the AI/ML bug bounty platform) fits the index. Short answer: **it doesn't fit the program
model anymore, because Huntr itself changed.** This doc records what Huntr is today, why the
roadmap's framing is stale, the options, and a recommendation.

---

## What the roadmap assumed

ROADMAP "Next" said: *"Cover Huntr + HackenProof (return) — AI/ML bounties (Huntr) and the platforms
we dropped when upstream went stale."* That framing dates from Huntr's 2023 launch, when Protect AI
acquired huntr and ran **ongoing bounties against 125+ open-source AI/ML repositories** (Hugging Face
Transformers, etc.). In that world Huntr ≈ a platform whose "programs" are OSS repos with a standing
scope — awkward but mappable onto `program → scope identifiers`.

## What Huntr actually is now (verified 2026-10-26)

Protect AI was absorbed into Palo Alto Networks, and huntr.com pivoted. The live site is **not** a
standing OSS-bounty directory. It is a board of **time-limited AI hacking challenges** (CTF-style
events with prize pots).

- Nav today: `Challenges` (NEW), `Blog`, `FAQ`, `Discord`, `Contact`. No "repos", no "bounties",
  no program directory. The old `/bounties` and `/repos` routes 404.
- `/challenges` lists event cards filtered by `All / Active / Upcoming / Closed`. Examples seen:
  "Hack AskNova - the Stock Trading Agent" ($15,000 pot, closed), "Blind Trust" ($15,000, active).
- Each challenge: a target AI system/agent, a prize **pot** (not a per-finding reward range), a
  start/end date, a status/stage, a rules page (`/challenges/<id>/v1/rules`) and a leaderboard.
- Data is available: huntr.com is a Next.js app; the challenges list ships in the RSC stream
  (`self.__next_f`) with clean fields — `title, status, stage, start_date, end_date,
  total_prize_amount, category, cover_image_url, is_featured, description`, each card at
  `/challenges/<id>`. Parseable (messier than Nuxt devalue, but doable).

## Why it doesn't fit `programs`

A bountyindex `program` is a **standing** entity: a company, an ongoing max-bounty, a set of in-scope
domains/assets, daily snapshots that diff over time. A Huntr challenge is the opposite on every axis:

| Axis | bountyindex program | Huntr challenge |
|---|---|---|
| Lifespan | ongoing | ephemeral (opens, closes) |
| Target | domains / URLs / contracts | one AI system or agent |
| Reward | min–max per finding | single prize pot, split by rank |
| Scope | list of identifiers (the moat) | "the rules page" — no asset list |
| Value over time | compounds via snapshots | gone once the event closes |

Forcing a challenge into `programs` would pollute the scope-lookup moat (no identifiers to index),
break the lifecycle/snapshot story (nothing to diff), and mislabel ephemeral events as standing
programs. The original "map repos → programs" idea is moot: those repos aren't a live surface.

---

## Options

**A. Don't cover Huntr.** It is no longer a bug bounty *program* platform; it's an AI-CTF events
site. A "bug bounty program index" can legitimately say Huntr is out of scope. Cost: zero. We lose
an "AI coverage" talking point.

**B. Cover it as a separate `challenges` surface** (NOT `programs`). A new lightweight entity +
`/challenges` page: a live board of time-boxed AI hacking events — title, target, prize pot,
status, countdown, link out. Own table (`challenges`), own ingest, own UI. Huntr is the first (and
today only) source; the surface could later absorb other AI-CTF events.

**C. Shoehorn into `programs`.** Rejected. Pollutes scope-lookup, breaks snapshots, lies about what
the row is. Documented only so we don't re-litigate.

## Recommendation

**A now, B when there's a reason.** Don't build this session. Rationale:

- It's a *new feature category*, not "coverage" — mis-scoped in the roadmap. Spending a solo
  session on an ephemeral, single-source events board is low ROI against distribution (Chrome
  ext / Burp) or community reviews.
- Single source = one scraper's worth of churn for a board that's empty between events. The AskNova
  / Blind Trust cadence looks like a handful of challenges a quarter.
- But it's a *real* differentiator if AI hunting grows: nobody aggregates these, and "live AI
  hacking challenges + prize pots + countdown" is timely and on-brand for the audience. Worth
  keeping warm.

**Trigger to build B:** either (1) a second AI-CTF source appears (so it's aggregation, not a
mirror), or (2) distribution/reviews are shipped and this is the best remaining differentiator.

## If/when we build B — the sketch

- **Table `challenges`**: `id, source ('huntr'), externalId, title, target, prizeAmount, currency,
  status ('active'|'upcoming'|'closed'), startDate, endDate, url, coverImageUrl, raw, firstSeenAt,
  lastSeenAt`. No `scopes` join — challenges have no asset list.
- **Ingest** `lib/ingest/huntr.ts`: parse the `/challenges` RSC payload (`self.__next_f`) for the
  card list; one row per challenge, upsert by `externalId`. Cheap (one page, ~no detail fetch
  needed for v1). No snapshot/diff machinery — status transitions (upcoming → active → closed) are
  the only "change" worth showing, derivable from dates.
- **UI** `/challenges`: active-first board, countdown on active, prize pot, target, link out.
  Surface it under the `Explore` nav dropdown, not mixed into `/programs`.
- **Explicitly skip**: scope-lookup integration, snapshots, watchlist, RSS (reconsider RSS if the
  board gets traffic), per-challenge detail pages (link out to Huntr instead).

## Decision log

- 2026-10-26: Researched live huntr.com. Confirmed pivot to timed challenges; old OSS-repo bounty
  model is gone. Chose **A (defer)**; recorded **B** as the shape to build if a trigger fires.
  ROADMAP updated: Huntr line reframed from "coverage" to "deferred — different product, needs its
  own surface."
