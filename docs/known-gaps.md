# known-gaps.md

Honest weaknesses of bounty.index, ranked by real-world impact on visits, retention, and popularity. Not a roadmap — a triage sheet. Each item lists: what's broken, who it hurts, whether it's worth fixing, and (if yes) the rough shape of the fix.

Companion doc to `moat.md` (which lists features to build) and `BRUTAL_REVIEW.md` (which lists what's wrong today). This one specifically answers: **if we lose users, which of these is why?**

Last audit: 2026-09-04.

---

## Tier 1 — Actually loses users. Fix or accept the ceiling.

### 1. No push notifications
- **What's missing:** No email, SMS, Slack, Discord, or webhook alerts. Watchlist + RSS is the whole push story.
- **Who it hurts:** Mainstream hunters who don't run a feed reader. They come once, watch a program, never get told when it changes, don't come back.
- **Why it's #1:** Bounty hunters check targets daily. If we don't ping, whoever does wins. bbradar's paid alerts exist for exactly this reason.
- **Fix (moat E3):** Discord webhook per watched program. ~1 week of work. Meets hunters in the tool they already sit in all day. Cheap channel, no email revival.
- **Why not email:** Deliberately killed. Not coming back. Distribution problems are solved by adding *channels*, not resurrecting email.

### 2. No private / invite-only programs
- **What's missing:** Synack, Zerocopter, most Cobalt engagements, private H1 & Bugcrowd programs.
- **Who it hurts:** The top ~10% of hunters who make real money on invite-only. Also the loudest voices on Twitter — losing them costs organic distribution.
- **Fix:** None. Those platforms are private by design. Structural ceiling, not a bug.
- **Implication:** Our TAM is "public bounty scene," not "all bounty hunters." Message accordingly.

### 3. Daily ingest latency
- **What's missing:** Cron runs once/day at 6am UTC (Vercel Hobby plan cap). New programs don't show until the next run.
- **Who it hurts:** Everyone, on the ~3-5 days per quarter when a whale program drops. Tweet goes out, everyone opens the platform directly, nobody opens us. Exactly the high-attention days we can't afford to miss.
- **Fix:** Move to Vercel Pro or self-hosted cron for hourly ingest. Costs money. Marginal value on the other 355 days per year is low.
- **Judgment call:** Live with it until Pro is justified by traffic.

---

## Tier 2 — Bothers a small vocal slice. Not urgent.

### 4. Bus factor of 1 / no SLA
- **What's missing:** Solo dev, no on-call, no formal uptime guarantee.
- **Who it hurts:** Enterprise hunters, BB team leads. Solo weekend hunters don't notice.
- **Fix:** Only matters if we ever charge. Repo is open-source (`Varun2024/Bounty-index`) so self-host is a real escape hatch. Note that publicly.

### 5. Neon free-tier quota fallback
- **What's missing:** When Neon quota hits, DB goes read-only and we serve reconstructed data from `arkadiyt/bounty-targets-data`.
- **Who it hurts:** Heavy users, during the outage window. Fallback is graceful (site stays browsable).
- **Fix:** Upgrade Neon plan when traffic justifies. Not visible until it fires — so easy to defer.

### 6. Immunefi scraper fragility
- **What's missing:** Immunefi isn't in `arkadiyt/bounty-targets-data`; we scrape their site directly. Breaks silently when they change markup.
- **Who it hurts:** Web3 hunters when it breaks. Usually noticed within 24h.
- **Fix:** Add a canary (e.g., "if <100 Immunefi programs after ingest, alert"). ~30 min of work. Worth doing.

---

## Tier 3 — Cosmetic. Nobody actually cares.

### 7. No semantic / AI search
- **What's missing:** Search is Postgres `pg_trgm` (fuzzy string match). No embeddings.
- **Reality:** Hunters type exact company names. `pg_trgm` handles typos. AI search is a "cool demo, never used" feature for this audience.
- **Fix:** Don't bother until multiple users specifically ask for natural-language search.

### 8. No submission portal
- **What's missing:** You still click through to the platform to file a report.
- **Reality:** Nobody expects an aggregator to broker submissions. Non-issue.
- **Fix:** N/A.

### 9. No historical archive UI
- **What's missing:** Snapshot data exists, but there's no "programs that existed in 2023 but died" browsable view.
- **Reality:** Interesting to security researchers writing papers, useless to hunters looking for today's target. Data already exposed via MCP.
- **Fix:** Only if a specific ask lands.

### 10. Opportunity score is subjective
- **What's missing:** Three weights I picked. Not validated against hunter outcomes.
- **Reality:** `/how-scored` exposes the whole formula — that transparency is the feature vs bbradar's opaque tiers. If someone disagrees they can sort by reward instead.
- **Fix:** N/A. Ship v2 signals (response-time, scope breadth) when denormalization lands, but the "subjective" critique doesn't push users away.

### 11. Sparse community response-time data
- **What's missing:** Most programs show "—" for median response time. `MIN_STATS_SAMPLE=3` guard.
- **Reality:** Not a reason to leave — just an unfinished feature waiting on the seed curve.
- **Fix:** Nothing to do but wait, or run a small "seed 10 popular programs with reports" campaign.

---

## Bottom line

| Concern | Losing users today? | Ceiling on TAM? |
|---|---|---|
| No push notifications | Yes | — |
| No private programs | Some | Yes |
| Daily ingest latency | Occasionally | — |
| Everything else | Not yet | — |

**Priority for retention work:** Discord bot (E3) is the highest-leverage single move. Converts "visited once" → "gets pinged in the server they sit in all day." Nothing else on this list moves the needle nearly as much.
