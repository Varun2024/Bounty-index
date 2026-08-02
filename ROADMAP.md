# Roadmap

Working doc. `NEXT_STEP.md` is the long wishlist — this is what actually ships.
Move items between Now / Next / Later as they progress. When Now empties, promote from Next.

---

## Now — building this week

- [x] **Snapshot on ingest** — write `program_snapshots` row every daily cron run (dedup by content hash; sparse rows). Populated by daily cron going forward.
- [x] **Advanced filters** — safe harbor added (bugcrowd data). Platform, asset type, VDP/paying, min payout, has-bounty were already in place. Public/private + auth-required deferred (not in source data).
- [x] **Compare programs** — `/compare` route + floating localStorage tray + per-program add button on detail pages. Max 4.
- [x] **Fuzzy search** — pg_trgm extension + GIN index on `search_text`. Query ranks by trigram similarity when `q` present.
- [x] **Trending / Recently added** — landing "Pulse" section with two panels: last-14d additions + last-30d top payouts. Real trending waits for snapshot history.

## Next — queued after Now empties

- [ ] Program page polish (reward range display, safe harbor badge, last-updated line)
- [ ] URL-state for filters (shareable filtered views) — prerequisite for "saved filters"
- [ ] **Personalization v1 (localStorage, no auth)**: favorites, saved filters, watchlist, recently viewed, personal notes. Portable via JSON export/import.
- [ ] Change-detection UI on program pages (reads from snapshots table)
- [ ] Better empty states across `/programs`, `/scope-lookup`, `/feed`

## Later — worth doing eventually

- [ ] Auth (GitHub OAuth only) — **only** promote if users explicitly ask for cross-device sync. Ships on top of the localStorage layer, doesn't replace it.

## Later — worth doing eventually

- [ ] Command palette (`Cmd+K`)
- [ ] Export CSV / JSON from filtered views
- [ ] Program timeline view (once snapshots have real history)
- [ ] Company pages (aggregate all programs from one org)
- [ ] Public API (only if there's actual demand — Arkadiyt's raw JSON already exists)

## Killed / deferred indefinitely

Kept here so we don't re-litigate.

- **Notifications** (email alerts, push, watchlist emails) — killed. RSS covers this for anyone motivated.
- **Weekly digest email** — killed with notifications.
- **Technology field** — not in source data, would need scanning/enrichment
- **Country / industry** — not in source data
- **Difficulty / competition / response time** — subjective, no source of truth
- **AI natural language search** — filter UI + `/` shortcut beats it for this audience
- **Community reviews / comments** — moderation burden not worth it for solo maintainer
- **Public API + SDK + CLI** — Arkadiyt's repo already is the API
- **Leaderboards** — needs user data first; revisit only if auth ships
- **Power-user features beyond personal notes** — no custom tags, no private recon notes as separate feature. One notes field per program per user, done.

---

## Rules

- Now list stays ≤ 5 items. Anything else goes to Next.
- If an item sits in Now for > 1 week without progress, demote or delete it.
- Long-tail ideas live in `NEXT_STEP.md`, not here.
