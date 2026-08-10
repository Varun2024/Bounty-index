# moat.md

Retention options for bounty.index, grouped by *mechanism* — the reason a user comes back — because that's the actual moat question, not the feature list. Complement to `ROADMAP.md` (which sequences the shortlist).

Freshness signal + personal accumulation + workflow integration is what makes people return. Adding more platforms is **not** a moat — bbradar has 24 and hunters still don't check it daily.

---

## A. Habit hooks — new stuff to check every day

| # | Feature | Effort | Notes |
|---|---|---|---|
| A1 | `/whats-new` page + RSS | ~1 day | One URL: every scope diff, reward change, safe-harbor flip in the last 24 hrs across all platforms. The "morning coffee" page. Extension of the per-program RSS we shipped. |
| A2 | "Newly paying" filter | ~0.5 day | Programs that flipped from VDP → bounty. Rare, but hunters care disproportionately. |
| A3 | Reward-change page / RSS | ~1 day | Just the money moves. `+$50k on GMX` matters even if scope didn't shift. |
| A4 | Curated news digest | ~3-5 days | Scrape HackerOne hacktivity highlights + Immunefi disclosures + Bugcrowd blog. Not raw data — a "what's interesting this week" digest. |

## B. Lock-in — their data lives here now

| # | Feature | Effort | Notes |
|---|---|---|---|
| B1 | Saved filter sets ("my daily scan") | ~2 days | Named URLs. Roadmap already. Underrated — converts a visitor into a bookmarker. |
| B2 | Personal notes per program | ~2 days | Private markdown per program, sign-in required. Once someone has notes on 20 programs, they're staying. |
| B3 | Watchlist history | ~1-2 days | Not just "watched" — "you've been watching Shopify for 3 months, here's the diff since you started." Shows the value of having stayed. |
| B4 | "First seen by you" badges | ~0.5 day | Implicit tracking. Signals to the user how early they were on a program. |

## C. Unique signal — data they can't get anywhere else

| # | Feature | Effort | Notes |
|---|---|---|---|
| C1 | Community response-time tracking | ~3-5 days | Crowdsourced. Users report their triage time. Public per-program score. **Probably the highest-value moat on this list** — genuinely differentiated data that platforms won't publish and hunters *will* trust because it's peer-sourced. |
| C2 | Program lifecycle chart | ~3-4 days | Timeline per program: scope adds, removes, reward changes over the snapshot history we've captured. Uses existing data. Nobody else has this because nobody else has been snapshotting daily. |
| C3 | "What's similar" | ~1 week | For any program, 5 others with overlapping scope surface. Embedding search over scope identifiers. Nudges exploration. |
| C4 | Opportunity score (public formula) | ~2 days | Roadmap already. Expose the formula publicly — that's the differentiator vs bbradar's opaque tiers. |

## D. Community — they come because others are here

| # | Feature | Effort | Notes |
|---|---|---|---|
| D1 | Community reviews | ~2 weeks | Real moat but needs a proper design pass on rating shape, moderation, reputation gating. Hold until lighter lock-in features validate retention. |
| D2 | Discussion threads per program | ~3-5 days | One comment field, GitHub-Discussions vibe. Way lighter than reviews. |
| D3 | Opt-in hunter profiles | ~1 week | Public "here's what I hunt" page. Turns users into evangelists who share their own profile. |

## E. Distribution — put you inside their existing workflow

| # | Feature | Effort | Notes |
|---|---|---|---|
| E1 | Chrome extension | ~1-2 weeks | On any H1/Bugcrowd/etc program page, side panel shows historical diffs, community rating, similar programs. **Huge.** |
| E2 | Burp Suite / Caido plugin | ~2 weeks | Pipe watched-program scope directly into their scanner. Hunters *live* in those tools. **Probably the strongest workflow lock-in on this list.** |
| E3 | Discord bot | ~1 week | Watch a program, get pinged in your own server. Cheap community play. |
| E4 | CLI (`bx watch shopify`) | ~3-5 days | Nerd credibility, low retention lift, great social signal. |

---

## Solo-operator ranking

**Ship first** — fast + high leverage, all compound on existing snapshot data. ✅ All four shipped 2026-08-09 → 2026-08-10:
- A1: `/whats-new` daily changelog ✅
- B1: Saved filter sets ✅
- B2: Personal notes ✅
- C2: Program lifecycle chart ✅

**Ship next** — medium effort, real moat:
- C1: Community response-time tracking

**Ship when you have a full week free** — distribution changes the game; retention stops mattering because users never leave your context:
- E1: Chrome extension, or
- E2: Burp / Caido plugin

**Hold** — validate lighter lock-in first:
- D1: Community reviews

---

## Anti-patterns to avoid

- **More platform coverage as a moat.** It isn't. bbradar has 4× our coverage; hunters still don't check daily.
- **Notification churn.** Email alerts were killed permanently. Add channels (Discord, Slack) *only* if the RSS story proves insufficient.
- **Gating what's already free elsewhere.** Bbradar's mistake — hunters just go to `arkadiyt/bounty-targets-data` on GitHub.
- **Paywalling the core index.** Never on the roadmap. Monetization lives in API access, "get listed" for private-program companies, and — much later — enterprise target-intel tooling.
