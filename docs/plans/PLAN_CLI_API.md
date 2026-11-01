# Plan — Public `/v1` REST API + CLI (auth'd)

> Status: **planned, not started.** Decided 2026-10-31. This is the distribution pick
> (moat E4). Chrome extension (E1) is dropped; the Burp/Caido plugin (E2) is parked for a
> much later stage.

## What we're building and why

A thin, authenticated public REST API at `/api/v1`, with a zero-dependency Node CLI sitting
on top of it. The point is distribution: put bounty.index inside the terminal workflow a
hunter already lives in, so the data comes to them instead of them coming to the site.

REST is the right shape for that audience. `bountyindex scope x.com | jq` is the kind of
thing people actually run, and a plain HTTP surface is consumable from any language or
script — not just our own CLI. The backend lift is small because the data layer already
exists: `GET /api/export/programs` already accepts the full filter set, so it is
`GET /programs` in all but name. The work is mostly a guard, a key model, and a handful of
thin route wrappers over queries we already have.

## Decisions

**Path B over Path A.** We chose a real REST API with a CLI client (Path B) over a CLI that
speaks MCP JSON-RPC directly (Path A). MCP is the agent surface; REST is the human/script
surface. They serve different callers and we want both.

**Behind auth — with an honest caveat.** Keys gate `/v1`. But auth here buys abuse
attribution, per-key rate limiting, usage tracking, and a clean hook for a future paid tier
— *not* site security. The data on `/v1` is already served unauthenticated by `/api/mcp/v2`
and `/api/export/programs`, so gating `/v1` does not reduce the site's exposure. Hardening
the open surfaces is the separate **security-audit** track, scheduled to run after this
lands so it can cover the new surface in the same pass.

**Free tier.** Auth is identity plus rate-limiting, not billing. GitHub sign-in is free, key
minting is free, and the per-key limit is generous (~300–600 req/min). The key model makes a
later paid tier (higher limits) trivial to add, but v1 is free for everyone.

## Auth design (fits the current stack)

Today: NextAuth v5, GitHub OAuth, **JWT sessions** — authed browsing never hits the DB, so a
Neon outage can't break sign-in. There is no `api_keys` table yet, so this is a clean slate.

- **New table `api_keys`** — `id, userId → users, label, keyPrefix, keyHash, createdAt,
  lastUsedAt, revokedAt`. We store **only** `sha256(key)`, never plaintext.
- **Key format `bki_<random>`** — ≥ 32 bytes, base62. The prefix is deliberately greppable so
  secret-scanners can flag a leaked key. The full key is shown **once** at creation;
  afterwards only `keyPrefix` identifies it.
- **Create-on-demand, not auto-minted at login.** Auto-generating a key during the OAuth
  redirect conflicts with hash-only storage — the plaintext exists only at the moment of
  creation, and there's nowhere to surface it mid-redirect. This is the same model as GitHub
  PATs, Stripe, and OpenAI.
- **Guard on `/api/v1/*`** — read `Authorization: Bearer bki_…` (or `X-API-Key`), hash it,
  look up by `keyHash`, reject if missing or revoked, attach `userId`. Per-key rate limiting
  reuses the `proxy.ts` LRU, keyed on the hash instead of the IP.
- **`lastUsedAt` is a throttled write**, not a best-effort-async one: we only write when the
  stored value is older than ~15 min. That keeps the "is this key still alive?" signal while
  dropping ~99% of the writes. (Considered and rejected: skipping it entirely; awaiting a
  write on every request.)
- **No existing users get signed out.** This adds a table and routes only — it does not touch
  `AUTH_SECRET`, the session strategy, or the JWT shape. (The earlier mass-logout came from
  the DB-session → JWT switch, which is unrelated.)
- **Outage behaviour (`ponytail:`)** — key validation needs a DB read, so the authed API will
  *not* ride out a Neon outage the way authed browsing does. That's acceptable for an API.
  Upgrade path if it ever matters: an in-memory validated-key LRU with a short TTL.

## Routes

Thin wrappers over existing queries. Alias the existing export route to
`/api/v1/programs`, then add the rest:

| Route | Query | Notes |
|---|---|---|
| `GET /api/v1/programs` | `listPrograms` | reuses the export route's filters; JSON by default |
| `GET /api/v1/programs/:platform/:slug` | `getProgramBySlug` | full scope |
| `GET /api/v1/scope?asset=` | `findByDomain` | the hero verb for hunters |
| `GET /api/v1/whats-new?days=` | `getRecentChanges` | |
| `GET /api/v1/stats` | `stats` | |
| *(later)* similar, timeline, top-payouts, recently-added, trending, bulk-scope | existing queries | mirror the 14 MCP tools |

## CLI

- Zero-dependency Node — `util.parseArgs` plus the global `fetch`. Publishable to npm.
- Reads its key from `BOUNTYINDEX_API_KEY` or `~/.config/bountyindex/key`.
- Subcommands map roughly 1:1 to routes. Human-readable table by default, pipe-friendly JSON
  with `--json`.
- The shape we're aiming for:
  - `bountyindex scope shop.example.com`
  - `bountyindex search --min 10000 --wildcard`
  - `cat domains.txt | bountyindex scope --bulk`
  - `bountyindex whats-new --days 7`

## Rollout

**Stage 1 — vertical slice.** Prove the whole path end to end with the smallest surface that
is actually useful:

- `migrations/004_api_keys.sql` plus `api_keys` in `lib/db/schema.ts`
- `lib/api-keys.ts` — generate, hash, verify, throttled `lastUsedAt`
- the `/api/v1` guard helper and per-key rate limit (extending `proxy.ts`)
- three routes: `GET /api/v1/scope`, `GET /api/v1/programs/:platform/:slug`, and the
  `GET /api/v1/programs` alias
- a `/settings/api-keys` dashboard for signed-in users: create (shown once), list, revoke
- a bare CLI covering those three verbs
- a docs section, either on `/mcp` or a new `/api` page

**Stage 2 — fill out and ship wide.**

- the remaining verbs, mirroring the 14 MCP tools
- the npm publish pipeline for the CLI
- the security audit covering the new surface (separate track)
