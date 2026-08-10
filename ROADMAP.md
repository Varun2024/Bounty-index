# Roadmap

Working doc. `NEXT_STEP.md` is the long wishlist — this is what actually ships.
Move items between Now / Next / Later as they progress. When Now empties, promote from Next.

Last updated: 2026-08-08 (after the bbradar.io competitive pass)

---

## Now — building this week

Pick 2-3. Keep it real.

Ranked by ROI × leverage of existing code. Items 1-3 close visible gaps against bbradar.io using data we already have; item 4 is where they're most ahead.

- [ ] **Public activity counts on program pages** — surface `+N scopes added / -M removed in the last 7 days` on each program detail page. Data already lives in `program_snapshots`; we just don't render it. Zero new infra, closes the biggest visible gap where bbradar looks smarter. ~1 hr.
- [ ] **Company logos on program pages** — replace platform-only dot with the actual company logo. Two paths: (a) `logo.dev` API by domain, (b) scrape favicon/OG image from `program.url` and cache. Small visual polish, big perception jump. ~2 hrs.
- [ ] **Per-program scope-change RSS** — `/programs/[platform]/[slug]/feed.xml` emitting each snapshot diff as an RSS `<item>`. Free version of bbradar Pro's scope-alerts. Uses existing snapshot data. ~2 hrs.
- [ ] **Coverage expansion (Immunefi first)** — Immunefi is DeFi/crypto bug bounties, 6-7 figure payouts. Highest-value niche where bbradar has the field to themselves. Own ingest since it's not in `arkadiyt/bounty-targets-data`. ~4-6 hrs including normalizer.

## Next — queued after Now empties

- [x] **Scope-changelog stream** — shipped as `/whats-new` (+ `/whats-new.xml`). Every scope, reward, and safe-harbor change across all programs, grouped by day, RSS-enabled. Free version of what bbradar Pro gates.
- [ ] **Program opportunity score** — algorithmic ranking from `max payout × in-scope surface × recent activity × safe-harbor status`. Cheap differentiator vs their opaque tiers. Expose the formula publicly.
- [ ] **Cover Huntr + HackenProof (return)** — AI/ML bounties (Huntr) and the platforms we dropped when upstream went stale.
- [ ] **Better empty states** — `/programs` when filters return zero, `/scope-lookup` when no query, `/feed` when no recent additions. Existing states are functional but bland.
- [ ] **Command palette (Cmd+K)** — jump-to-program, quick actions. Real time-saver once you use it daily.
- [ ] **Watchlist RSS feed** — `/watchlist.xml?ids=1,2,3` (or per signed-in user) surfacing snapshot diffs in a feed reader. Replaces the email notifications we killed.
- [x] **Saved filter sets** — signed-in users can name + save filter combos. localStorage fallback signed-out; merges to server on sign-in. Section lives in the filters rail on `/programs`.
- [ ] **Community reviews (design first, code second)** — needs a design chat: rating shape, moderation model, reputation gating. Held for a proper scoping session.

## Later — worth doing eventually

- [ ] **"Get Listed" B2B page** — companies with unlisted programs can request to be indexed. Small B2B foothold.
- [ ] **Cover Standoff365, Sherlock, Compass Security** — long-tail platforms bbradar includes; adds coverage but each is a bespoke normalizer for smaller audiences.
- [ ] **Public API** — Arkadiyt's raw JSON already exists; only build ours if there's demand for the *normalized* shape.
- [ ] **URL-state polish** — the `q` search input doesn't reflect in the URL until Enter. Debounce+push.
- [ ] **Personal notes on programs** — signed-in only, per-user. Requires design decisions on richness (plain text? markdown? word cap?).
- [ ] **Company pages** — aggregate all programs from one org. Requires org detection heuristics.

## Killed / deferred indefinitely

Kept here so we don't re-litigate.

- **Email notifications** — killed. RSS covers it.
- **Weekly digest email** — killed with notifications.
- **Discord/Telegram bots** — deferred until community exists to receive them. Building a bot before there's a community is order-of-ops wrong.
- **Technology field** — not in source data, would need site fingerprinting.
- **Country / industry** — not in source data.
- **AI natural language search** — filter UI + `/` shortcut beats it for this audience.
- **SDK / CLI** — Arkadiyt's repo already is the raw API.
- **Leaderboards** — needs user data first.
- **Custom tags** — folded into personal-notes; won't build both.

---

## Shipped

Ordered newest first. Commit hashes for archaeology.

### 2026-08-07 (SEO + domain + XML fixes)
- Sitemap/RSS/BreadcrumbList URL-encoded to handle slugs with `&` etc. (`4d9ba6f`)
- Google verification + WebSite/Organization/BreadcrumbList JSON-LD + preset landing pages (`/programs/paying`, `/safe-harbor`, `/wildcard`) + improved program-detail titles/descriptions (`d015fcb`)
- OG image spec-compliant (1200×630, 41KB), canonical, siteName (`81b5060`)
- Profile dropdown redesign — personal buckets moved out of top nav (`dffc591`)
- Cross-device sync for watchlist + compare (`ad6745f`)
- Auth adapter fix (real drizzle instance for detection) (`12e9f30`)
- Auth foundation: GitHub OAuth via Auth.js v5 + Drizzle adapter (`43070a9`)
- Domain migration to `www.bountyindex.in`

### 2026-08-06 (hunter-review pass)
- Bulk export (CSV + JSON) (`4e27b63`)
- Reward range + program timeline (`22bc492`)
- Roadmap refresh (`6005525`)
- Brutal review saved to disk (`70f153f`)
- Fuzzy scope search (`00e38fa`)
- Grouped scope by asset type (`e611309`)
- Watchlist with snapshot diff (`4372e17`)
- Scope-lookup dedup + name disambiguation (`668432f`)
- Scope-lookup out-of-scope warning (`91e9660`)
- Safe-harbor coverage caveat (`549d1cd`)

### 2026-08-05
- Cleanup pass: dead code, JSX apostrophes, `useSyncExternalStore` refactor (`85262a3`)
- Builder credit in footer (`d907470`, brightened `c5f7785`)
- LaunchLeague badge (`74dc488`)
- Real platform SVG logos + hero copy v2 + `/how-it-works` + workflow tilt (`06d37c1`)
- Compare programs + landing Pulse section (`2bab17f`)
- Snapshot history + fuzzy search + safe-harbor filter (`05cf56d`)

---

## Competitive intel

**bbradar.io** (2026-08-08 walkthrough) is the closest competitor. Highlights:

- **Ahead of us on:** coverage (24 vs 5 platforms), notification channels (Discord/Telegram/RSS), program activity signals, opportunity scoring, community (Discord), Pro tier (€89/yr working monetization).
- **Behind us on:** scope lookup (they don't have paste-a-domain), side-by-side compare, free access to identifiers (they gate behind Pro), UI polish.
- **Strategic posture:** they're a paying-customer product. We're a free utility. Trying to catch their monetized moat head-on is a losing race — build free versions of what they gate, widen coverage, and keep the UX edge.

Detailed comparison lives in this session's transcript; formal doc if that stops being enough.

---

## Rules

- Now list stays ≤ 5 items. Anything else goes to Next.
- If an item sits in Now for > 1 week without progress, demote or delete it.
- Long-tail ideas live in `NEXT_STEP.md`, not here.
- Every entry ships or moves. No "in progress" forever.
