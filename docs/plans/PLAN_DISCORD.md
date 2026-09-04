# Plan: Discord alerts (webhook, not bot)

Implements **E3** from `moat.md`, addresses the #1 retention gap identified in `known-gaps.md` ("no push notifications"). Converts *"visited once"* → *"gets pinged in the server they sit in all day"*.

Reference:
- Moat rationale: [`moat.md#E3`](../roadmap/moat.md)
- Gap this closes: [`known-gaps.md`](../reviews/known-gaps.md) — Tier 1, item #1
- Existing watchlist code (reused for auth + program-picker UX): `app/watchlist/*`, `lib/db/schema.ts::watchlist`

---

## Why webhook, not a real bot

| Concern | Real Discord bot | Discord webhook (chosen) |
|---|---|---|
| Setup for user | OAuth invite to server, `/watch` slash commands | Server Settings → Integrations → New Webhook → paste URL here (5 clicks) |
| Infra on our side | Hosted process holding a gateway connection | Zero — one HTTPS POST per event, from the existing cron |
| Discord verification | Required at 100+ servers | Never |
| Cross-user in a server | Yes | No — one webhook per subscriber |
| Effort | ~1 week | ~1.5–2 days |

The webhook covers ~95% of the value at ~15% of the effort. If demand for slash commands emerges post-launch, upgrade — the data model won't need to change, only the delivery front-end.

**Rule locked in:** any user-supplied URL we POST to is whitelisted to Discord's webhook hosts. No exceptions. This is an SSRF surface if we ever loosen it.

---

## Data model

One new table, kept independent from `watchlist` (different concern: watchlist is a bookmark, this is a delivery target).

```sql
CREATE TABLE discord_webhooks (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id        INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  webhook_url       TEXT NOT NULL,          -- validated: must be https://discord.com/api/webhooks/... or /discordapp.com/...
  label             TEXT,                   -- optional user-facing name ("#security-alerts")
  last_delivered_at TIMESTAMPTZ,            -- prevents double-sends on cron retries
  broken_at         TIMESTAMPTZ,            -- set on 404 / 401; UI shows a fix-me chip; no further delivery attempts
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, program_id, webhook_url)
);
CREATE INDEX discord_webhooks_program_id_idx
  ON discord_webhooks (program_id) WHERE broken_at IS NULL;
```

Cascade rules:
- `ON DELETE CASCADE` on `users` → deleting an account removes all their webhooks (GDPR-lite)
- `ON DELETE CASCADE` on `programs` → deleting a program removes stale subscriptions

---

## What ships (v1 scope)

1. **User creates a webhook in their own Discord server.** Server Settings → Integrations → Webhooks → New Webhook → Copy URL. Standard Discord flow, documented on our end with a screenshot.
2. **User pastes the URL into bounty.index** at `/settings/discord`, associates it with one or more programs.
3. **Daily ingest cron**, after snapshots write, iterates each program with a non-empty new diff and POSTs an embed to every webhook subscribed to it. Uses `last_delivered_at` to stay idempotent.
4. **Discord renders a formatted embed** in that channel: program name (linked to bounty.index), one-line change summary, timestamp.

---

## Files touched

| File | Purpose |
|---|---|
| `lib/db/schema.ts` | New `discord_webhooks` table |
| `drizzle/*.sql` | Push migration |
| `lib/discord.ts` | URL validator, embed formatter, `postDiffToWebhook()` |
| `app/actions/discord.ts` | `addWebhook`, `removeWebhook`, `listMyWebhooks` server actions (auth-gated) |
| `app/settings/discord/page.tsx` | Paste URL → pick programs → list current subs (+ broken chips) |
| `app/programs/[platform]/[...slug]/discord-button.tsx` | "Get Discord alerts →" CTA on each program page, prefills the program in the settings flow |
| `lib/ingest/deliver-discord.ts` | Iterates diffs, calls `postDiffToWebhook`, updates `last_delivered_at` / `broken_at` |
| `app/api/cron/ingest/route.ts` | Final step: `await deliverDiscordAlerts(newDiffs)` |
| `docs/discord.md` | User-facing setup guide with screenshot |
| `app/sitemap.ts` | Add `/settings/discord` (low priority) |

Nothing else moves. No changes to existing watchlist code — the CTA button just links to the new settings page.

---

## Message shape

One embed per diff. Scannable, not marketing. Discord embed color coded by change type (green if only additions, amber if removals, blue on reward change).

```
Shopify   ·   +3 added   −1 removed   ·   reward $50k → $75k
────────────────────────────────────────────────────────────
+ api.new-service.shopify.com
+ *.checkout-v2.shopify.com
+ mobile.shopify.com (ios)
− community.shopify.com

View → bountyindex.in/programs/hackerone/shopify
```

Fields on the embed:
- `author.name` = platform (e.g. "HackerOne")
- `author.icon_url` = platform logo asset (already exists in `/public`)
- `title` = program name, linked
- `description` = the one-line summary
- `fields` = up to 3 added + 3 removed identifiers (rest as "+N more")
- `timestamp` = `diff.capturedAt`
- `footer.text` = "bounty.index · reply STOP to unsubscribe" — no, drop that, webhooks can't receive. Just `bountyindex.in`.

If Discord rejects the embed (400), fall back to plain text with the same info.

---

## Corners named up front

- **SSRF.** `webhook_url` is user input we POST to. Validator whitelists `https://discord.com/api/webhooks/` and `https://discordapp.com/api/webhooks/` only. Reject anything else at write time. Non-negotiable — this is the whole security surface of the feature.
- **Rate limits.** Discord permits ~30 requests/min per webhook URL. If one user subscribes 50 programs and all change in one ingest, space POSTs at ~2/sec per URL. Naive `await sleep(50)` between calls per URL is enough.
- **Broken webhooks.** On `404` or `401`, set `broken_at = NOW()`. UI shows a red chip; no further attempts. User re-saves to clear.
- **Idempotency.** Cron may retry same day. Guard: only deliver when `diff.capturedAt > COALESCE(last_delivered_at, 'epoch')`.
- **Auth requirement.** Must be signed in with GitHub (already shipped). Prevents anonymous webhook creation → prevents someone using our infra to spam an unrelated Discord server.
- **Volume cap per user.** Soft cap at 25 webhook subscriptions per user. Hard cap at 100. Prevents abuse.
- **Delete-all.** "Remove all my Discord webhooks" button on settings page. `ON DELETE CASCADE` on users covers account deletion path.
- **No email revival.** This is explicit. Discord is a *new* channel, not a return to notifications-as-email. Anyone asking for email gets a "no" and a link to RSS.

---

## Effort breakdown

| Task | Est |
|---|---|
| Schema + migration | 1h |
| `lib/discord.ts` (validator + embed formatter + POST) | 2h |
| Server actions | 2h |
| Settings UI page | 3h |
| Program-page CTA button | 1h |
| Cron integration + idempotency | 2h |
| Docs page + screenshot | 1h |
| End-to-end test with real webhook | 1h |
| **Total** | **~13h / 1.5–2 days** |

---

## Explicitly **not** in v1

- No slash commands, no bot user, no OAuth invite flow
- No per-filter subscriptions (*"alert me on any newly-paying wildcard"*) — only per-program. Revisit if requested.
- No cross-user server semantics — one webhook = one subscriber
- No batching / daily-digest mode. Every diff is a separate embed. If it's too noisy in practice, add a per-webhook `mode: instant | digest` toggle in v2.
- No message customization. One template, take it or leave it.
- No Slack, no Telegram, no Matrix. Discord first, evaluate demand for others afterwards.

---

## Success criteria

- **20+ webhooks live within a week** of announcement
- **<5% delivery error rate** across daily runs
- At least one unsolicited comment (Reddit, Twitter, GitHub issue) along the lines of *"finally, I got pinged the moment X changed"*

If those hit → v2 (slash-command bot, per-filter subs) becomes justifiable.
If they don't → push notifications weren't the bottleneck we thought. Update `known-gaps.md` accordingly and don't build a bot.

---

## v2 candidates (do not scope now)

- Slash-command bot (`/bounty watch shopify`) — requires OAuth, hosted process, Discord verification once we hit 100 servers
- Per-filter subscriptions — "alert me on any newly-paying program in web3 scope"
- Digest mode — one message per day summarizing all changes for a webhook
- Slack / Telegram parity via same delivery abstraction
- Server-wide subscriptions (one person watches, everyone in the server sees)
