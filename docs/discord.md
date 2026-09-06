# Discord alerts — setup guide

Pipe every scope, reward, and safe-harbor change on a program into a channel in your own Discord server. One HTTPS POST per event. No email, no bot to invite, no OAuth.

## What you get

Every time we detect a change on a program you've subscribed, we post an embed like this in your channel:

```
Shopify   ·   +3 added   −1 removed   ·   reward $50k → $75k
────────────────────────────────────────────────────────────
+ api.new-service.shopify.com
+ *.checkout-v2.shopify.com
+ mobile.shopify.com
− community.shopify.com

View → bountyindex.in/programs/hackerone/shopify
```

Color coded — green for pure additions, amber for anything with removals or a payout drop, sky for reward-only changes.

## Setup (3 steps, ~1 minute)

### 1. Get a webhook URL from Discord

In your Discord server:
1. **Server Settings** → **Integrations** → **Webhooks**
2. Click **New Webhook**
3. Pick the channel that should receive alerts
4. Give it a name (e.g. "bounty.index alerts")
5. Click **Copy Webhook URL**

The URL looks like `https://discord.com/api/webhooks/1234567890/AbCdEf-xyz…`. Treat it like a secret — anyone with it can post to your channel.

### 2. Paste it into bounty.index

Go to [bountyindex.in/settings/discord](https://bountyindex.in/settings/discord). Sign in with GitHub if you haven't. Paste the URL, pick which program should fire it, save.

Alternate: open any program page and hit the **Discord →** button — the settings form will pre-fill that program.

### 3. Wait for the next ingest

We run a daily ingest cron. When a snapshot diff lands for a subscribed program, the embed shows up in your channel within seconds. Multiple subscriptions to the same URL are spaced ~50ms apart to stay under Discord's rate limit.

## Managing subscriptions

All at [bountyindex.in/settings/discord](https://bountyindex.in/settings/discord):
- **List** — every subscription with masked URL, label, last delivery time
- **Remove** — one click per row
- **Broken chip** — appears on any subscription where Discord returned 401/404 (usually means the webhook was deleted in Discord). Re-save the URL to clear it.

## FAQ

**Can I get one webhook to fire for multiple programs?**
Yes. Paste the same URL, subscribe to as many programs as you want. Each is a separate row on the settings page.

**Does one program push to multiple channels?**
Yes. Same program, different webhook URLs → both fire.

**What about scope-filter-based alerts ("any newly-paying wildcard")?**
Not in v1. Per-program only. If enough people ask, we'll add it.

**Digest mode (one message a day summarizing everything)?**
Also not in v1. Every diff is a separate embed. Tell us if it's noisy.

**Does the webhook expose my account?**
No. We only send the diff — no reference to who subscribed. Anyone in the Discord channel sees the same message.

**Can I hit "STOP" from Discord to unsubscribe?**
No — webhooks are one-way, Discord can't send messages back to us. Remove the subscription from the settings page.

**Rate limits?**
Discord permits ~30 requests/min per webhook URL. Cap yourself at ~25 subscriptions per webhook and you'll never see a 429.

**What about Slack / Telegram / Matrix?**
Discord first. If it takes off, others follow. Tell us which one.

## Security notes

- We validate the URL at write time — only `discord.com/api/webhooks/…` and `discordapp.com/api/webhooks/…` are accepted. Anything else is rejected. This is our SSRF surface.
- URLs are stored as-is (they're the credential). Deleting your account cascades to delete all webhooks.
- We never send content other than the diff embed. Payloads don't include your user ID, IP, or any personal metadata.
