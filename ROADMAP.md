# Roadmap

Working doc. `NEXT_STEP.md` is the long wishlist — this is what actually ships.
Move items between Now / Next / Later as they progress. When Now empties, promote from Next.

Last updated: 2026-08-06

---

## Now — building this week

Pick 2-3. Keep it real.

- [ ] **Bulk export from filtered `/programs`** — CSV + JSON download of the current filter set. Turns the site into a research tool for pentesters and security teams. High ROI: real hunter workflow, small diff.
- [ ] **Program timeline view** — snapshot data now spans ~3 weeks; render a per-program history strip on the detail page (reward changes, scope additions/removals over time). Uses the same diff code as `/watchlist`, just plotted.
- [ ] **Reward range display** — currently shows only `max`. When both min and max exist, render `$500 – $100K`. Small, but every hunter reads this before spending time on a target.

## Next — queued after Now empties

- [ ] **Better empty states** — `/programs` when filters return zero, `/scope-lookup` when no query, `/feed` when no recent additions. Existing states are functional but bland.
- [ ] **Command palette (Cmd+K)** — jump-to-program, quick actions. Real time-saver once you use it daily.
- [ ] **Company pages** — aggregate all programs from one org (e.g. Google has HackerOne + separate Chrome + Android). Requires org detection which the source data doesn't provide reliably; may need manual mapping table.
- [ ] **Watchlist export as JSON** — one button on `/watchlist` to dump the list + latest snapshots. Enables cross-device via manual paste, matches the "portable state" ethos.
- [ ] **URL-state polish** — current filters are URL-backed but the `q` search input doesn't reflect in the URL until Enter. Debounce+push.

## Later — worth doing eventually

- [ ] **Auth (GitHub OAuth only)** — only promote if users explicitly ask for cross-device sync. Ships on top of the localStorage layer, doesn't replace it.
- [ ] **Public API** — Arkadiyt's raw JSON already exists; only build ours if there's demand for the *normalized* shape.
- [ ] **Watchlist RSS feed** — a hunter's `/watchlist.xml?ids=1,2,3` that surfaces snapshot changes in their feed reader. Replaces email notifications (which are killed).
- [ ] **Saved filter sets** — localStorage: name + share URL for a filtered view.

## Killed / deferred indefinitely

Kept here so we don't re-litigate.

- **Notifications** (email alerts, push, watchlist emails) — killed. RSS covers this for anyone motivated.
- **Weekly digest email** — killed with notifications.
- **Technology field** — not in source data, would need site fingerprinting.
- **Country / industry** — not in source data.
- **Difficulty / competition / response time / recent-payout counts** — subjective or requires hacktivity scraping; deferred until a real data source lands.
- **AI natural language search** — filter UI + `/` shortcut beats it for this audience.
- **Community reviews / comments** — moderation burden not worth it for solo maintainer.
- **SDK / CLI** — Arkadiyt's repo already is the raw API.
- **Leaderboards** — needs user data first; revisit only if auth ships.
- **Custom tags / private recon notes** — folded into the single personal-notes idea; won't build both.

---

## Shipped

Ordered newest first. Commit hashes for archaeology.

### Since 2026-08-06 (hunter-review pass)
- Fuzzy scope search — `/programs?q=X` now also matches in-scope identifiers, not just program name (`00e38fa`)
- Grouped scope by asset type on program detail page — wildcards / urls / apis / mobile / hardware buckets (`e611309`)
- Watchlist with per-program snapshot diff — localStorage-backed, no auth (`4372e17`)
- Scope-lookup dedup + name-collision disambiguation (`668432f`)
- Scope-lookup surfaces explicit out-of-scope hits (amber warning) (`91e9660`)
- Safe-harbor coverage caveat visible in filter rail (`549d1cd`)

### Since 2026-08-05
- Cleanup pass: dead code, JSX apostrophes, `useSyncExternalStore` refactor (`85262a3`)
- Builder credit in footer (`d907470`, brightened `c5f7785`)
- LaunchLeague badge (`74dc488`)
- Real platform SVG logos + hero copy v2 + `/how-it-works` + workflow tilt (`06d37c1`)
- Compare programs + landing Pulse section (`2bab17f`)
- Snapshot history + fuzzy search + safe-harbor filter (`05cf56d`)

---

## Rules

- Now list stays ≤ 5 items. Anything else goes to Next.
- If an item sits in Now for > 1 week without progress, demote or delete it.
- Long-tail ideas live in `NEXT_STEP.md`, not here.
- Every entry ships or moves. No "in progress" forever.
