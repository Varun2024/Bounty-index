# PLAN: Public `/v1` REST API + CLI (auth'd)

> Status: **planned, not started.** Decided 2026-10-31. This is the distribution pick
> (moat E4). Chrome extension (E1) dropped; Burp/Caido plugin (E2) parked for a much
> later stage.

## Decision record

- **Path B chosen** over "CLI speaks MCP JSON-RPC" (Path A). REST is the right shape for a
  terminal audience (`bountyindex scope x.com | jq`), consumable from any language/script,
  not just a Node CLI. The backend gap is small because `GET /api/export/programs` already
  takes the full filter set — it's `GET /programs` in all but name.
- **Behind auth** (user requirement). Honest caveat recorded: this does **not** reduce risk
  from the already-open surfaces (`/api/mcp/v2`, `/api/export/programs` serve the same data
  unauthenticated). Auth on `/v1` is for abuse attribution, per-key rate limiting, usage
  tracking, and a future paid-tier hook — not site security. The site-security work is the
  separate audit track.
- **Free tier.** Auth = identity + rate-limiting, not billing. GitHub sign-in free, key
  minting free, generous per-key limit (~300–600 req/min). Key model makes a later paid
  tier (higher limits) trivial but v1 is free for everyone.
- **Build order:** vertical slice first (table + guard + 3 routes + minimal key dashboard
  + bare CLI), then the rest of the verbs + npm publish. Security audit **after** the API
  lands, so it covers the new surface in one pass.

## Auth design (fits current stack)

Current: NextAuth v5, GitHub OAuth, **JWT sessions** (authed browsing never hits the DB, so
a Neon outage can't break sign-in). No `api_keys` table exists yet — clean slate.

- **New table `api_keys`:** `id, userId → users, label, keyPrefix, keyHash, createdAt,
  lastUsedAt, revokedAt`. Store **only** `sha256(key)` — never plaintext.
- **Key format** `bki_<random>` (≥ 32 bytes, base62). Deliberately greppable prefix so
  secret-scanners can flag leaks. Show the full key **once** at creation; thereafter only
  `keyPrefix` for identification.
- **Create-on-demand, not auto-minted at login.** Auto-gen conflicts with hash-only storage
  (plaintext exists only at creation; nowhere to show it during the OAuth redirect). Same
  model as GitHub PATs / Stripe / OpenAI.
- **`/api/v1/*` guard:** read `Authorization: Bearer bki_…` (or `X-API-Key`), hash, look up
  by `keyHash`, reject if missing/revoked, attach `userId`. Per-key rate limit reusing the
  `proxy.ts` LRU keyed on the hash instead of IP.
- **`lastUsedAt` = throttled write**, not best-effort-async: only write when the stored
  value is older than ~15 min. Keeps the "is this key dead?" signal while killing ~99% of
  the writes. (Alternatives considered: skip entirely; await every request — rejected.)
- **No existing users get signed out.** This adds a table + routes only; it does not touch
  `AUTH_SECRET`, session strategy, or JWT shape. (The earlier mass-logout was the
  DB-session → JWT switch — unrelated.)
- **Outage note (`ponytail:`):** key validation needs a DB read, so the authed API won't
  survive a Neon outage the way authed browsing does. Acceptable for an API. Upgrade path:
  in-memory validated-key LRU with short TTL if it ever matters.

## Routes (thin wrappers over existing queries)

Alias existing export route to `/api/v1/programs`, then add:

| Route | Query | Notes |
|---|---|---|
| `GET /api/v1/programs` | `listPrograms` | reuse export route's filters; JSON default |
| `GET /api/v1/programs/:platform/:slug` | `getProgramBySlug` | full scope |
| `GET /api/v1/scope?asset=` | `findByDomain` | the hero verb for hunters |
| `GET /api/v1/whats-new?days=` | `getRecentChanges` | |
| `GET /api/v1/stats` | `stats` | |
| (later) similar, timeline, top-payouts, recently-added, trending, bulk-scope | existing queries | mirror the 14 MCP tools |

## CLI

- Zero-dep Node: `util.parseArgs` + global `fetch`. Publishable to npm.
- Reads key from `BOUNTYINDEX_API_KEY` env or `~/.config/bountyindex/key`.
- Subcommands map ~1:1 to routes. Pipe-friendly JSON out (`--json`), human table default.
- Examples:
  - `bountyindex scope shop.example.com`
  - `bountyindex search --min 10000 --wildcard`
  - `cat domains.txt | bountyindex scope --bulk`
  - `bountyindex whats-new --days 7`

## Vertical-slice checklist (first build)

- [ ] `migrations/004_api_keys.sql` + `api_keys` in `lib/db/schema.ts`
- [ ] `lib/api-keys.ts` — generate, hash, verify, throttled `lastUsedAt`
- [ ] `/api/v1` guard helper + per-key rate limit (extend `proxy.ts`)
- [ ] `GET /api/v1/scope`, `GET /api/v1/programs/:platform/:slug`, alias `GET /api/v1/programs`
- [ ] `/settings/api-keys` dashboard (signed-in): create (show once) / list / revoke
- [ ] bare CLI for those 3 verbs
- [ ] docs section on `/mcp` or a new `/api` page

## Then

- [ ] Remaining verbs + npm publish pipeline
- [ ] Security audit covering the new surface (separate track)
