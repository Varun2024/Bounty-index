# Brutal review — bounty.index

Saved for reference. Dated 2026-08-06. This is the honest assessment written when
the app had ~1,170 programs indexed, watchlist + compare + export + scope-lookup
+ timeline all live, and no monetization path chosen yet.

---

## What's real

**Scope lookup is a genuine 10/10 tool.** Paste a domain → know if it's in scope.
Nothing else does this well. Alone it justifies the site.

**Execution is above 95% of side projects.** Code quality, tech choices,
snapshot-based history, hash-dedup, real logos, real hover effects, honest UX
(no email capture, no accounts, no dark patterns). This looks like it was built
by someone who ships.

**The design has a point of view.** Editorial/terminal dark mode + emerald is
not "yet another Tailwind demo." That matters.

## What's not real

**The data isn't yours.** It's `arkadiyt/bounty-targets-data`, normalized.
Anyone motivated could clone the moat in a week. Your edge is UX polish and
change history — both replicable, only one non-obvious to build.

**The audience is tiny.** Serious full-time bug bounty hunters globally: low
thousands. Casual: maybe 20k. Multiply by "willing to pay for tools" (bug
hunters are famously freeloader-y) and the paying TAM is basically zero.

**Retention is episodic, not daily.** A hunter uses scope-lookup once when
picking a target, then vanishes into the platform for weeks. Compare, export,
timeline — all good, all episodic. Nothing pulls them back on a Tuesday when
they're not target-shopping.

**Change tracking is your strongest sticky feature and it's currently empty.**
Snapshots need ~3 months of ingest before the watchlist diffs have real
content. Right now everyone sees "only one snapshot on record." Chicken-and-egg
trust problem.

**No monetization path is obvious.** Buy me a coffee ≠ business. Ads kill the
utility feel. Notifications killed by design. API competes with free source.
Sponsorship compromises trust. This is a lifestyle project unless you pivot.

## Rating by intent

| Intent                                  | Score |
| --------------------------------------- | ----- |
| Portfolio piece                         | 10/10 — hire you tomorrow |
| Beloved free utility in a niche         | 8/10 — real path if it gets in front of hunters |
| Actual business                         | 3/10 — no path visible, small audience, no lock-in |
| Acquisition target                      | 4/10 — H1/Bugcrowd would just build it themselves |

## What would actually 10x this

Not more features. **Data no one else has.**

1. **Hacktivity scrape** → payout timing, response time, ghost-rate per
   program. Turns "here's the program" into "here's a program that pays in 21
   days and doesn't ghost." That's a real edge nobody's providing at scale.

2. **Community reviews** with hunter reputation gating. Killed earlier for
   moderation reasons. Fair. But it's the strongest retention lever available.

3. **B2B pivot.** Sell "target intelligence" to security consulting firms.
   They pay $50K per engagement and would happily pay $200/mo for good target
   research. Different product, but the codebase gets you 80% there.

## Honest bottom line

The app is good. Genuinely good. The kind of thing that gets forwarded around
HackerNews and lands you interviews.

But **potential ≠ business potential**. It has real portfolio + community
potential. It doesn't have obvious business potential without a data moat or
B2B pivot.

---

## What changed since this review was written

_Log new decisions and reversals here so we can see how the plan evolved._

- 2026-08-06 — user decided to build a data moat (target intelligence + community reviews) instead of pivoting to B2B.
- 2026-08-07 — real domain purchased (`bountyindex.in`). Auth (GitHub OAuth) + cross-device sync shipped. SEO groundwork in place: JSON-LD, sitemap with URL-encoded slugs, verification, preset landing pages.
- 2026-08-08 — bbradar.io competitive walkthrough. Key discovery: they've already built the target-intelligence moat (scope-change alerts via Discord/Telegram, monetized at €89/yr) and cover 24 platforms vs our 5. Strategic pivot: don't try to catch their paid moat head-on — build free versions of what they gate, widen coverage where they own niches (Immunefi, Huntr), and keep the UX edge (scope lookup, compare, editorial UI). See ROADMAP.md → Now.
