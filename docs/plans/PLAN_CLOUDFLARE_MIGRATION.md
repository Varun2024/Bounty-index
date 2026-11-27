# PLAN: Vercel → Cloudflare migration

Purpose: move bountyindex.in off Vercel (Hobby limits hit, project paused) onto Cloudflare
Workers via the OpenNext adapter, keeping Neon Postgres as-is. Decided 2026-11-27: straight
cutover, accept downtime (no interim Vercel Pro).

## STATUS: COMPLETE (2026-11-27)

bountyindex.in serves entirely from Cloudflare Workers. Verified live: all core pages + MCP +
auth 200; R2 incremental cache (96 entries) + D1 tag cache + DO queue active; GitHub login works
(prod OAuth app `Ov23liQu6nBMPXKQ6hMV`); www → apex 301; daily ingest = GitHub Action at 06:00 UTC
(green, revalidates via `/api/revalidate`), NOT a CF cron (full scrape blows the Worker subrequest
cap — see [[project-cloudflare-migration]] memory). standoff365 retired (re-platformed to an
unscrapeable SPA). Vercel kept paused as rollback for one cycle. Remaining optional: delete Vercel
project after a stable cycle; revisit standoff365 only if it matters; finish CF free-feature toggles.

## Why this is a real fix, not a band-aid

The last incident's band-aid was a fresh Vercel account to reset the counter. This is different:
the cost drivers (ISR writes, OG-image CPU) move onto Cloudflare's free tier (Workers 100k
req/day, R2/KV free tiers), which fits this traffic profile. The DB is already Neon serverless
Postgres over HTTP, so it runs unchanged from Workers. No data migration.

## What stays untouched

- Neon Postgres (`@neondatabase/serverless` + `postgres` + drizzle). Same `DATABASE_URL`.
- All app code, routes, MCP endpoints, auth logic, charts (visx, server-rendered).
- `pg_trgm` fuzzy search (DB-side).

## What must change (the real Vercel surface)

| Vercel thing | Where | Replacement |
|---|---|---|
| ISR / incremental cache | app-wide `revalidate` | OpenNext R2 incremental cache binding |
| `revalidateTag(PROGRAMS_CACHE_TAG)` | `api/cron/ingest`, `lib/db/queries.ts` | OpenNext **tag cache** (D1 or DO) — see Risk 1 |
| `@vercel/blob` | `lib/signup-queue.ts` | **Remove** (queue dropped, Decision 1) |
| `@vercel/analytics` | `app/layout.tsx` | Drop (or CF Web Analytics beacon, zero-code) |
| `@vercel/config` (`vercel.ts`) | repo root | `wrangler.jsonc` |
| Cron `0 6 * * *` | `vercel.ts` | CF Cron Trigger → ingest (see Risk 2) |
| Next 16.2.12 | `package.json` | Next **16.4.5+** (OpenNext adapter floor) |
| OG routes (`next/og` satori/resvg) | `app/og/*`, `opengraph-image` | Works on Workers; verify WASM bundle size (Risk 3) |
| Auth.js `AUTH_URL` (auto on Vercel) | `auth.ts` | Set explicitly to prod URL |

## Decisions (locked 2026-11-27)

1. **Signup fallback queue: DROP IT.** Remove `lib/signup-queue.ts`, its `enqueueSignup` call in
   `auth.ts`, and the pending-signups replay UI in `app/admin/page.tsx`. Accept losing signups
   during a (rare, managed-Neon) DB outage. Kills the `@vercel/blob` dependency outright.
2. **Ingest: try CF Cron Trigger, fall back to GitHub Action.** Attempt on the Worker in Phase 2;
   if CPU/time limits bite, move ingest to a GH Action cron hitting the DB directly. Either way
   auth stays `CRON_SECRET` bearer.

## Phases

### Phase 0 — branch + adapter spike (exit: preview renders home + one data page) ✅ DONE
- [x] Branch `feat/cloudflare-migration`.
- [x] Bump Next 16.2.12 → 16.4.6, React/types aligned; `build` green locally.
- [x] `@opennextjs/cloudflare` + `wrangler`; `wrangler.jsonc` w/ `nodejs_compat`, `open-next.config.ts`.
- [x] `opennextjs-cloudflare build && ... preview`; `/`, `/programs`, data pages, OG, MCP all 200.

### Phase 1 — caching (exit: ingest run busts caches, fresh data within one page load on preview)
Account: Varunshukla747@gmail.com (ID 57c29b6d007206182bba73484abcac98), wrangler logged in.
- [x] Config wired: `open-next.config.ts` (r2 inc cache + do queue + d1 tag cache); `wrangler.jsonc`
      bindings (NEXT_INC_CACHE_R2_BUCKET, NEXT_TAG_CACHE_D1, NEXT_CACHE_DO_QUEUE + v1 migration).
- [x] D1 created: `bounty-index-tag-cache` id `0fb8f7b9-792a-4843-9073-4f2cfc24b1f2`.
- [x] R2 enabled + bucket `bounty-index-inc-cache` created.
- [x] Preview verified: R2 inc cache populated (96 entries), D1 tag table created. **DO queue is
      production-only** (doesn't run in `wrangler dev`; class IS exported, warning is benign) — so
      the full `revalidateTag`/time-revalidation loop gets its definitive proof on a deployed
      Workers URL, not local preview.

### Phase 2 — blob + analytics + deps (cron is separate, below) — CODE DONE 2026-11-27
- [x] Dropped signup queue: deleted `lib/signup-queue.ts`, stripped enqueue from `auth.ts`
      (kept the outage read-swallow behavior), removed Pending-signups UI from `app/admin/page.tsx`.
- [x] Removed `@vercel/analytics` from `layout.tsx`. `track()` (Discord funnel events in
      `add-webhook-form.tsx`) rerouted through `lib/analytics.ts` shim (no-op). **DECISION PENDING:
      wire a real sink (Cloudflare Analytics Engine) to restore the funnel, or accept no-op.**
- [x] Removed `@vercel/blob` + `@vercel/analytics` + `@vercel/config` (32 pkgs pruned). Deleted
      `vercel.ts`. Removed dead `nullOnError`. Updated `how-it-works` copy to Cloudflare.
- [x] **Analytics Engine wired** (Decision: restore the funnel). `ANALYTICS` dataset binding +
      `app/api/track/route.ts` (validated public endpoint, writes one data point) + client
      `lib/analytics.ts` sendBeacon shim. Verified: valid event → 200, junk → 400.
- [x] **Cron trigger wired** (Decision 2: CF first). `custom-worker.ts` wraps `handler.fetch` +
      adds `scheduled()` that self-invokes `/api/cron/ingest` via WORKER_SELF_REFERENCE with the
      cron bearer; re-exports `DOQueueHandler`. wrangler `main` → `custom-worker.ts`,
      `triggers.crons`. Excluded from tsconfig (wrangler bundles it). Fetch path verified in
      preview; `scheduled()` provable only on deploy. **Fallback stays GH Action if ingest exceeds
      Worker limits at test time.**
- [x] cf-typegen footgun fixed: generated `cloudflare-env.d.ts` injected workerd globals that
      clashed with the Next DOM types (broke 2 untouched files). Deleted + gitignored; the one
      binding used is typed locally in `route.ts`.
- [x] `next build` + `opennextjs-cloudflare build` both green with the custom worker.

### Phase 2 — blob + cron + analytics (exit: signup replay works; manual cron trigger ingests)
- [ ] Decision 1: R2 swap in `signup-queue.ts` (or remove). Verify admin replay UI.
- [ ] Decision 2: ingest on CF Cron Trigger (or GH Action). Auth stays `CRON_SECRET` bearer.
- [ ] Remove `@vercel/analytics` (+ CF Web Analytics if wanted). Delete `vercel.ts`.

### Phase 3 — auth + env (exit: GitHub login works on the preview URL)
- [ ] All env vars set in Workers (table below). `AUTH_URL` explicit.
- [ ] Update GitHub OAuth app callback to the new domain.

### Phase 4 — cutover (exit: bountyindex.in serves from Cloudflare, Vercel project removable)
- [ ] Custom domain on Worker; DNS cutover (lower TTL first).
- [ ] Smoke: home, /programs, a program detail, /mcp, OG image, login, admin, manual ingest.
- [ ] Watch for 24h. Keep Vercel project paused (not deleted) as rollback for one cycle.

## Env vars to move (Workers secrets)

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_URL` (set explicit),
`CRON_SECRET`, `FEEDBACK_WEBHOOK_URL`, Discord webhook vars, R2 creds (new), plus any MCP
rate-limit / telemetry vars.

## Risks

1. **Tag cache is the subtle one.** `revalidateTag` is how daily ingest makes data fresh. If the
   OpenNext tag cache backend isn't configured, pages go stale silently. Verify in Phase 1, not
   at cutover.
2. **Ingest CPU/time budget.** 300s Vercel function ≠ Worker. Validate early; GH Action is the
   fallback.
3. **OG image WASM bundle.** resvg WASM can push the Worker bundle toward the size limit. Check
   after Phase 0 build; worst case, pre-render OG or move to an R2-cached image.
4. **MCP handler on Workers.** `mcp-handler` + DB rate limiter should port; confirm it needs no
   Redis for SSE session state.
6. **`proxy.ts` (middleware).** It's an in-memory per-IP limiter on `/api/mcp*`. OpenNext
   `proxy.ts` support is experimental (since adapter 1.20.3). Two effects on Workers: the
   experimental support itself, and the in-memory `Map` being near-useless on ephemeral isolates.
   The real limiter is the DB-backed one inside the MCP handler, so this is a weakened first line,
   not a correctness break. Candidate to simplify/remove if the experimental proxy misbehaves.

## Phase 0 findings (2026-11-27) — COMPLETE, all green on local workerd preview

- Next 16.2.12 → **16.4.6** builds green with zero code changes. React 19.2.4 already satisfies.
- Adapter `@opennextjs/cloudflare@1.20.19` + `wrangler@4.168.0`. OpenNext build succeeds.
- Config: `open-next.config.ts` (empty/minimal), `wrangler.jsonc` (name `bounty-index`,
  `nodejs_compat` + `global_fetch_strictly_public`), `next.config.ts` init call, `public/_headers`,
  `.dev.vars` (from `.env`, keys normalized), scripts added. `workerd`/`esbuild` postinstall approved.
- Preview smoke (all 200): `/`, `/programs`, `/platforms/hackerone`, `/stats`, a program detail.
  **Neon reachable from workerd.** OG images render (`image/png`, resvg WASM OK → Risk 3 cleared).
  MCP `initialize` returns valid JSON-RPC over SSE, no Redis (Risk 4 cleared for init).
- `proxy.ts`: builds with the expected "Node.js middleware experimental" warning (Risk 6). Works.
- **Tag-cache sizing insight:** ingest busts a single shared tag (`PROGRAMS_CACHE_TAG`), not
  per-page tags, so the tag cache is tiny regardless of page cardinality → **D1 tag cache**
  (simpler) is the right call over DO-sharded in Phase 1.

### Phase 1+ gate (needs the user)
Phase 1 (caching) and deploy need a **Cloudflare account** + `wrangler login` (interactive) to
create the R2 bucket, D1 database, and the DO queue. Can't proceed past local preview without it.
5. **Rollback.** Vercel stays paused (not deleted) through one full cycle; DNS can point back.

## Rollback

DNS back to Vercel + unpause the project. DB is shared and unchanged, so no data rollback needed.
