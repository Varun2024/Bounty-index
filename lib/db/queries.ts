import { unstable_cache } from 'next/cache';
import { db, schema } from './client';
import { and, or, eq, ilike, gte, gt, isNotNull, desc, sql, inArray, ne, getTableColumns } from 'drizzle-orm';
import { AGGREGATE_MIN_N } from '../disclosed';
import type { ProgramReportStats } from '../reports';

// ponytail: single tag busts every public read cache from the ingest cron, which is the
// real freshness mechanism — data only changes once a day at ingest. The time-based
// revalidate is just the safety net for a missed tag bust, so it matches the data's daily
// cadence. At 300s it was rewriting every cached query every 5min on access (~288x/day) for
// data that changes once a day, which was a top ISR-write driver. 1 day self-heals a dead cron.
const CACHE_TAG = 'programs-data';
const CACHE_REVALIDATE = 86400;
export const PROGRAMS_CACHE_TAG = CACHE_TAG;

// unstable_cache serializes Date → ISO string on cache hit. Walk the return and
// convert ISO-shaped strings back to Date so consumers can call .getTime() etc.
// Mutates in place — the cached object isn't shared across requests in a way
// that matters here (second revive is a no-op since Dates aren't strings).
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
function reviveDates<T>(x: T): T {
  if (x == null || typeof x !== 'object') return x;
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      if (typeof v === 'string' && ISO_RE.test(v)) x[i] = new Date(v);
      else if (v && typeof v === 'object') reviveDates(v);
    }
    return x;
  }
  for (const k of Object.keys(x as object)) {
    // Never descend into the jsonb blobs. `raw` (upstream record) and `payload` (snapshot) hold
    // arbitrary upstream strings — some can look exactly like ISO datetimes (a scope instruction,
    // a description). Reviving those to Date corrupts them; a later `.toLowerCase()`/`.includes()`
    // on what the caller still believes is a string then throws at render. Real timestamp COLUMNS
    // are always top-level keys, so skipping these two loses no genuine Date.
    if (k === 'raw' || k === 'payload') continue;
    const v = (x as Record<string, unknown>)[k];
    if (typeof v === 'string' && ISO_RE.test(v)) (x as Record<string, unknown>)[k] = new Date(v);
    else if (v && typeof v === 'object') reviveDates(v);
  }
  return x;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cachedWithDates<Args extends any[], R>(
  fn: (...args: Args) => Promise<R>,
  keys: string[],
  opts: { revalidate: number; tags: string[] },
): (...args: Args) => Promise<R> {
  // ponytail: reviver MUST run AFTER unstable_cache. The cache serializes its
  // return value — Dates become strings in storage. Running revive inside the
  // cached fn only helps the cache-miss path; cache HITs serve raw strings and
  // crash the second visit. Wrapping outside makes every call pay the walk and
  // every call get Dates.
  const cached = unstable_cache(fn, keys, opts);
  return async (...args: Args) => reviveDates(await cached(...args));
}
import { diffSnapshots, isEmptyDiff } from '../snapshots';
import { opportunityScoreSql } from '../opportunity';
import { bucketize } from '../payout-buckets';
import {
  listProgramsFallback,
  getProgramBySlugFallback,
  findByDomainFallback,
  statsFallback,
  topPayoutsFallback,
  getProgramsByIdsFallback,
} from '@/lib/fallback/upstream';
import type {
  ProgramFilters,
  SnapshotPayloadShape,
  ProgramSnapshot,
  WatchlistEntry,
  RecentChange,
  SimilarProgram,
} from './types';

// Re-export the shared types so callers can keep importing them from '@/lib/db/queries'.
export type { ProgramFilters, SnapshotPayloadShape, ProgramSnapshot, WatchlistEntry, RecentChange, SimilarProgram };

// Read-only fallback: on any DB error (Neon quota, cold-start timeout, credential drift),
// serve reconstructed data from arkadiyt/bounty-targets-data so the site stays browsable.
// Only wraps read paths that can be rebuilt from upstream; snapshot-history features
// (whats-new, feed's firstSeenAt) and per-user tables intentionally still throw.
//
// Circuit breaker: after 3 consecutive failures, skip the DB for 5min and go straight to
// fallback. During a Neon quota outage every request otherwise pays for a doomed round-trip.
// ponytail: module-level state, per-instance. Serverless spawns many instances → each trips
// independently, which is fine — the breaker's job is p95, not global coordination.
const BREAKER_THRESHOLD = 3;
const BREAKER_COOLDOWN_MS = 5 * 60 * 1000;
let breakerFailures = 0;
let breakerOpenedAt = 0;

export function isDbDegraded(): boolean {
  return breakerOpenedAt > 0 && Date.now() - breakerOpenedAt < BREAKER_COOLDOWN_MS;
}

// Only infra-class failures (Neon down / quota / network) should open the breaker. A code or SQL
// bug (a bad column, a syntax error) must NOT — opening the breaker on it would serve stale
// fallback for 5min and hide the bug. Non-infra errors still fall back for the request (no 500),
// but every request keeps retrying + logging so the bug stays visible and clears the instant it's fixed.
function isInfraError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    m.includes('fetch failed') || m.includes('econnrefused') || m.includes('etimedout') ||
    m.includes('timeout') || m.includes('network') || m.includes('quota') ||
    m.includes('rate limit') || m.includes('too many connections') || m.includes('connection') ||
    m.includes('429') || m.includes('502') || m.includes('503') || m.includes('504')
  );
}

async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>, label: string): Promise<T> {
  if (isDbDegraded()) return fallback();
  try {
    const result = await primary();
    breakerFailures = 0;
    breakerOpenedAt = 0;
    return result;
  } catch (err) {
    if (isInfraError(err)) {
      breakerFailures++;
      if (breakerFailures >= BREAKER_THRESHOLD) breakerOpenedAt = Date.now();
    } else {
      console.error(`[db-fallback] ${label} → NON-INFRA error (breaker NOT tripped):`, err instanceof Error ? (err.stack ?? err.message) : err);
    }
    console.error(`[db-fallback] ${label} → upstream:`, err instanceof Error ? err.message : err);
    return fallback();
  }
}

async function listProgramsDb(f: ProgramFilters = {}) {
  const page = Math.max(1, f.page ?? 1);
  // Cap at 5000 so exports can pull the full set (~1.2k rows today) without a caller-injected DoS.
  const pageSize = Math.min(5000, Math.max(1, f.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  // Fuzzy search: when q present, match on program searchText (name/handle/slug) OR on any
  // in-scope identifier containing the token. Both sides accelerated by pg_trgm GIN indexes.
  // Trigram similarity() catches typos on the name side; ILIKE substring catches partials
  // that trigrams score too low, and drives the scope-identifier match.
  const q = f.q?.trim();
  let programIdsByScope: number[] | null = null;
  if (q) {
    const scopeMatches = await db
      .selectDistinct({ id: schema.scopes.programId })
      .from(schema.scopes)
      .where(and(eq(schema.scopes.inScope, true), ilike(schema.scopes.identifier, `%${q}%`)))
      .limit(500);
    programIdsByScope = scopeMatches.map((r) => r.id);
  }
  const qClause = q
    ? or(
        ilike(schema.programs.searchText, `%${q}%`),
        sql`${schema.programs.searchText} % ${q}`,
        programIdsByScope && programIdsByScope.length > 0
          ? inArray(schema.programs.id, programIdsByScope)
          : undefined,
      )
    : undefined;

  const where = and(
    qClause,
    f.platform?.length ? inArray(schema.programs.platform, f.platform) : undefined,
    f.programType && f.programType !== 'all' ? eq(schema.programs.programType, f.programType) : undefined,
    f.hasBounty ? eq(schema.programs.offersBounty, true) : undefined,
    f.minReward ? gte(schema.programs.maxBounty, f.minReward) : undefined,
    f.safeHarbor ? and(isNotNull(schema.programs.safeHarbor), ne(schema.programs.safeHarbor, 'none')) : undefined,
  );

  let programIdsByAsset: number[] | null = null;
  if (f.assetType?.length) {
    const rows = await db
      .selectDistinct({ id: schema.scopes.programId })
      .from(schema.scopes)
      .where(and(eq(schema.scopes.inScope, true), inArray(schema.scopes.assetType, f.assetType)));
    programIdsByAsset = rows.map((r) => r.id);
    if (!programIdsByAsset.length) return { rows: [], total: 0, page, pageSize };
  }

  // Per-program disclosed-payout aggregates, computed as correlated subqueries so the list can
  // filter and sort on "real" (actually-paid) data without denormalizing. USD-only (null currency =
  // USD, case-insensitive, amount > 0 — matching lib/disclosed.ts): >99% of disclosed amounts are
  // already USD, and doing FX in SQL isn't worth it for a list ranking — a `ponytail:` corner.
  //
  // The inner table is aliased `dr` and the outer correlation is the literal "programs"."id": inside
  // a sql`` template drizzle renders a column ref unqualified ("id"), which Postgres binds to
  // disclosed_reports.id (the inner scope) — silently returning 0. Aliasing + an explicit outer
  // qualifier is the only correct correlation. ("programs" is the un-aliased table name below.)
  //
  // ponytail: each aggregate is a correlated subquery, so a page costs ~2 index lookups per returned
  // row (and the hasDisclosed/sort filters scan all ~1.2k programs once). Fine at this scale + 300s
  // cache; upgrade to a LATERAL join or grouped CTE if the catalog grows past a few thousand.
  const drWhere = sql`dr.program_id = "programs"."id" AND dr.bounty_amount IS NOT NULL AND dr.bounty_amount > 0 AND (dr.currency IS NULL OR upper(dr.currency) = 'USD')`;
  const medianSub = sql<number | null>`(SELECT ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY dr.bounty_amount))::int FROM ${schema.disclosedReports} dr WHERE ${drWhere})`;
  const countSub = sql<number>`(SELECT count(dr.bounty_amount)::int FROM ${schema.disclosedReports} dr WHERE ${drWhere})`;

  // Only pay for the subqueries when a caller needs them: the /programs page (withDisclosed) shows a
  // real-payout line on every row, and the disclosed filter/sort need them. Other callers (export up
  // to 5000 rows, MCP, search) get NULL/0 constants and no subquery cost or extra output columns.
  const needDisclosed = Boolean(f.withDisclosed || f.hasDisclosed || f.sort === 'disclosed');
  const disclosedMedian = needDisclosed ? medianSub : sql<number | null>`NULL`;
  const disclosedN = needDisclosed ? countSub : sql<number>`0`;

  // Median is an aggregate statistic — gate the filter on AGGREGATE_MIN_N (not the individual-amount
  // tier), matching lib/disclosed.ts: a median over fewer than 8 points is noise. The row display is
  // gated on the same constant in app/programs/page.tsx.
  const disclosedWhere = f.hasDisclosed ? and(where, sql`${countSub} >= ${AGGREGATE_MIN_N}`) : where;
  const finalWhere = programIdsByAsset
    ? and(disclosedWhere, inArray(schema.programs.id, programIdsByAsset))
    : disclosedWhere;

  // When a search term is present, always sort by relevance first, then fall back to the user's chosen sort.
  const secondarySort =
    f.sort === 'reward'
      ? sql`${schema.programs.maxBounty} DESC NULLS LAST`
      : f.sort === 'name'
        ? schema.programs.name
        : f.sort === 'opportunity'
          ? sql`${opportunityScoreSql()} DESC`
          : f.sort === 'disclosed'
            ? // id tiebreaker: most medians are NULL and ties are common, so without a stable key
              // OFFSET pagination could skip/duplicate rows across pages.
              sql`${medianSub} DESC NULLS LAST, ${schema.programs.id}`
            : sql`${schema.programs.firstSeenAt} DESC NULLS LAST`;
  const orderBy = q
    ? sql`similarity(${schema.programs.searchText}, ${q}) DESC, ${secondarySort}`
    : secondarySort;

  const [rows, totalRow] = await Promise.all([
    db
      .select({ ...getTableColumns(schema.programs), disclosedMedian, disclosedN })
      .from(schema.programs)
      .where(finalWhere)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.programs).where(finalWhere),
  ]);

  return { rows, total: totalRow[0]?.c ?? 0, page, pageSize };
}

async function getProgramsByIdsDb(ids: number[]) {
  if (!ids.length) return [];
  const rows = await db.select().from(schema.programs).where(inArray(schema.programs.id, ids));
  // Aggregate scope counts per program in one query to avoid N+1
  const scopeCounts = await db
    .select({
      programId: schema.scopes.programId,
      total: sql<number>`count(*)::int`,
      inScope: sql<number>`sum(case when ${schema.scopes.inScope} then 1 else 0 end)::int`,
    })
    .from(schema.scopes)
    .where(inArray(schema.scopes.programId, ids))
    .groupBy(schema.scopes.programId);
  const scopeMap = new Map(scopeCounts.map((c) => [c.programId, c]));
  // Preserve request order (URL ids sequence)
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is (typeof rows)[number] => !!r)
    .map((r) => ({ ...r, scopeTotal: scopeMap.get(r.id)?.total ?? 0, scopeInScope: scopeMap.get(r.id)?.inScope ?? 0 }));
}

async function getProgramBySlugDb(platform: string, slug: string) {
  const [program] = await db
    .select()
    .from(schema.programs)
    .where(and(eq(schema.programs.platform, platform), eq(schema.programs.slug, slug)))
    .limit(1);
  if (!program) return null;
  const scopeRows = await db.select().from(schema.scopes).where(eq(schema.scopes.programId, program.id));
  return { program, scopes: scopeRows };
}

async function findByDomainDb(domain: string) {
  const d = domain.toLowerCase().trim();
  if (!d) return [];
  const rows = await db
    .select({
      program: schema.programs,
      scope: schema.scopes,
    })
    .from(schema.scopes)
    .innerJoin(schema.programs, eq(schema.scopes.programId, schema.programs.id))
    .where(or(ilike(schema.scopes.identifier, `%${d}%`), ilike(schema.scopes.identifier, `%*.${d}%`)))
    .limit(400);
  return rows;
}

async function topPayoutsDb(limit = 5) {
  return db
    .select()
    .from(schema.programs)
    .where(and(eq(schema.programs.offersBounty, true), isNotNull(schema.programs.maxBounty)))
    .orderBy(sql`${schema.programs.maxBounty} DESC NULLS LAST`)
    .limit(limit);
}

async function statsDb() {
  const [programs] = await db.select({ c: sql<number>`count(*)::int` }).from(schema.programs);
  const [bountyPrograms] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.programs)
    .where(eq(schema.programs.offersBounty, true));
  const [assets] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(schema.scopes)
    .where(eq(schema.scopes.inScope, true));
  const [platforms] = await db.select({ c: sql<number>`count(distinct ${schema.programs.platform})::int` }).from(schema.programs);
  const [lastRun] = await db
    .select({ at: schema.sources.lastRunAt })
    .from(schema.sources)
    .where(eq(schema.sources.lastStatus, 'ok'))
    .orderBy(desc(schema.sources.lastRunAt))
    .limit(1);
  return {
    programs: programs?.c ?? 0,
    bountyPrograms: bountyPrograms?.c ?? 0,
    inScopeAssets: assets?.c ?? 0,
    platforms: platforms?.c ?? 0,
    lastIngestAt: lastRun?.at ?? null,
  };
}

export const newestPrograms = cachedWithDates(
  async (limit = 50) =>
    db.select().from(schema.programs).where(isNotNull(schema.programs.firstSeenAt)).orderBy(desc(schema.programs.firstSeenAt)).limit(limit),
  ['newestPrograms'],
  { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] },
);

// Programs first seen within the last `days` days, most recent first.
export const recentlyAdded = cachedWithDates(
  async (limit = 8, days = 14) =>
    db
      .select()
      .from(schema.programs)
      .where(sql`${schema.programs.firstSeenAt} > now() - ${sql.raw(`interval '${days} days'`)}`)
      .orderBy(desc(schema.programs.firstSeenAt))
      .limit(limit),
  ['recentlyAdded'],
  { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] },
);

// "Trending" v1: highest payouts among recent additions. Real trending arrives when snapshot history has ≥ 2 weeks of data.
export const trendingNewPayouts = cachedWithDates(
  async (limit = 6, days = 30) =>
    db
      .select()
      .from(schema.programs)
      .where(
        and(
          sql`${schema.programs.firstSeenAt} > now() - ${sql.raw(`interval '${days} days'`)}`,
          eq(schema.programs.offersBounty, true),
          isNotNull(schema.programs.maxBounty),
        ),
      )
      .orderBy(sql`${schema.programs.maxBounty} DESC NULLS LAST`)
      .limit(limit),
  ['trendingNewPayouts'],
  { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] },
);

// Distinct platforms + program counts. Used by the MCP `list_platforms` tool. No fallback —
// callers should tolerate an empty array on DB failure (the tool returns "unavailable" text).
export const listPlatformsWithCounts = cachedWithDates(
  async (): Promise<{ platform: string; programs: number }[]> => {
    try {
      const rows = await db
        .select({
          platform: schema.programs.platform,
          programs: sql<number>`count(*)::int`,
        })
        .from(schema.programs)
        .groupBy(schema.programs.platform)
        .orderBy(sql`count(*) DESC`);
      return rows;
    } catch (err) {
      console.error('[listPlatformsWithCounts] failing open:', err instanceof Error ? err.message : err);
      return [];
    }
  },
  ['listPlatformsWithCounts'],
  { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] },
);

// Similar programs by count of shared in-scope identifiers. Naive exact-match count — good
// enough as a first pass because company-specific identifiers (*.shopify.com etc.) are unique
// to their owner. If noise creeps in later, filter out identifiers with very high global counts.
export const getSimilarPrograms = cachedWithDates(
  getSimilarProgramsUncached,
  ['getSimilarPrograms'],
  { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] },
);

async function getSimilarProgramsUncached(programId: number, limit = 5): Promise<SimilarProgram[]> {
  try {
    const ranked = await db
      .select({
        id: schema.scopes.programId,
        overlap: sql<number>`count(*)::int`,
      })
      .from(schema.scopes)
      .where(
        and(
          eq(schema.scopes.inScope, true),
          ne(schema.scopes.programId, programId),
          inArray(
            schema.scopes.identifier,
            db
              .select({ identifier: schema.scopes.identifier })
              .from(schema.scopes)
              .where(and(eq(schema.scopes.programId, programId), eq(schema.scopes.inScope, true))),
          ),
        ),
      )
      .groupBy(schema.scopes.programId)
      .orderBy(sql`count(*) DESC`)
      .limit(limit);
    if (!ranked.length) return [];
    const ids = ranked.map((r) => r.id);
    const progs = await db.select().from(schema.programs).where(inArray(schema.programs.id, ids));
    const byId = new Map(progs.map((p) => [p.id, p]));
    return ranked
      .map((r) => {
        const p = byId.get(r.id);
        return p ? { program: p, overlap: Number(r.overlap) } : null;
      })
      .filter((x): x is SimilarProgram => x !== null);
  } catch (err) {
    console.error('[getSimilarPrograms] failing open:', err instanceof Error ? err.message : err);
    return [];
  }
}

export const getProgramSnapshots = cachedWithDates(
  getProgramSnapshotsUncached,
  ['getProgramSnapshots'],
  { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] },
);

async function getProgramSnapshotsUncached(programId: number): Promise<ProgramSnapshot[]> {
  const rows = await db
    .select({
      capturedAt: schema.programSnapshots.capturedAt,
      payload: schema.programSnapshots.payload,
    })
    .from(schema.programSnapshots)
    .where(eq(schema.programSnapshots.programId, programId))
    .orderBy(schema.programSnapshots.capturedAt);
  return rows.map((r) => ({ capturedAt: r.capturedAt, payload: r.payload as SnapshotPayloadShape }));
}

// Columns the "Real payouts" card needs — deliberately omits the heavy jsonb payload (the report
// URL is rebuilt from external_id). Newest first; the card re-sorts amount-bearing rows by value.
export interface DisclosedReportRow {
  externalId: string;
  bountyAmount: number | null;
  currency: string | null;
  disclosedAt: Date;
  severity: string | null;
  title: string | null;
}

export const getDisclosedReports = cachedWithDates(
  getDisclosedReportsUncached,
  ['getDisclosedReports'],
  { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] },
);

async function getDisclosedReportsUncached(programId: number): Promise<DisclosedReportRow[]> {
  return db
    .select({
      externalId: schema.disclosedReports.externalId,
      bountyAmount: schema.disclosedReports.bountyAmount,
      currency: schema.disclosedReports.currency,
      disclosedAt: schema.disclosedReports.disclosedAt,
      severity: schema.disclosedReports.severity,
      title: schema.disclosedReports.title,
    })
    .from(schema.disclosedReports)
    .where(eq(schema.disclosedReports.programId, programId))
    .orderBy(desc(schema.disclosedReports.disclosedAt))
    .limit(2000); // bound the cached row set; newest-first, and no program is remotely near this.
}

export interface PayoutDistribution {
  counts: number[]; // one per PAYOUT_BANDS, aligned
  n: number; // disclosed USD amounts in the corpus
  median: number | null;
  programs: number; // distinct mapped programs contributing an amount
}

// Corpus-wide payout distribution for the home "what they actually pay" chart. USD-only, amount>0,
// to match the per-program histogram. Cached + revived like the other reads; throws on DB failure
// (the home page catches → the section just doesn't render, no fake numbers).
export const disclosedPayoutDistribution = cachedWithDates(
  async (): Promise<PayoutDistribution> => {
    const rows = await db
      .select({ amt: schema.disclosedReports.bountyAmount, pid: schema.disclosedReports.programId })
      .from(schema.disclosedReports)
      .where(
        sql`${schema.disclosedReports.bountyAmount} IS NOT NULL AND ${schema.disclosedReports.bountyAmount} > 0 AND (${schema.disclosedReports.currency} IS NULL OR upper(${schema.disclosedReports.currency}) = 'USD')`,
      );
    const amts = rows
      .map((r) => r.amt)
      .filter((n): n is number => typeof n === 'number')
      .sort((a, b) => a - b);
    const n = amts.length;
    const median = n === 0 ? null : n % 2 ? amts[(n - 1) / 2] : Math.round((amts[n / 2 - 1] + amts[n / 2]) / 2);
    const programs = new Set(rows.map((r) => r.pid).filter((p): p is number => p != null)).size;
    return { counts: bucketize(amts), n, median, programs };
  },
  ['disclosedPayoutDistribution'],
  { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] },
);

export async function getWatchlist(ids: number[]): Promise<WatchlistEntry[]> {
  if (!ids.length) return [];
  const programs = await db.select().from(schema.programs).where(inArray(schema.programs.id, ids));

  // Snapshots are sparse (only writes when content_hash changes), so fetching all rows for the
  // watched set is cheap. Bucket per program in JS, sort desc by capturedAt, take first two.
  // ponytail: JS-side bucketing. If watchlists grow >100 programs, switch to a window-function query.
  const allSnaps = await db
    .select({
      programId: schema.programSnapshots.programId,
      capturedAt: schema.programSnapshots.capturedAt,
      payload: schema.programSnapshots.payload,
    })
    .from(schema.programSnapshots)
    .where(inArray(schema.programSnapshots.programId, ids))
    .orderBy(desc(schema.programSnapshots.capturedAt));

  const bucket = new Map<number, { latest: SnapshotPayloadShape | null; previous: SnapshotPayloadShape | null; latestAt: Date | null }>();
  for (const row of allSnaps) {
    const entry = bucket.get(row.programId);
    const payload = row.payload as SnapshotPayloadShape;
    if (!entry) {
      bucket.set(row.programId, { latest: payload, previous: null, latestAt: row.capturedAt });
    } else if (!entry.previous) {
      entry.previous = payload;
    }
    // Rows are already ordered DESC; anything after the second snapshot is discarded.
  }

  const byId = new Map(programs.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is (typeof programs)[number] => !!p)
    .map((p) => ({
      program: p,
      latest: bucket.get(p.id)?.latest ?? null,
      previous: bucket.get(p.id)?.previous ?? null,
      latestAt: bucket.get(p.id)?.latestAt ?? null,
    }));
}

// One entry per snapshot diff (predecessor → current) where `current.capturedAt` falls inside
// the window. Snapshots are sparse (only written when content_hash changes), so any snapshot in
// the window IS a change — we just need to pair each with its predecessor to compute what
// actually shifted.
export const getRecentChanges = cachedWithDates(
  getRecentChangesUncached,
  ['getRecentChanges'],
  { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] },
);

async function getRecentChangesUncached(hoursBack = 168, limit = 200): Promise<RecentChange[]> {
  const cutoff = new Date(Date.now() - hoursBack * 3_600_000);

  // 1. Programs with any snapshot inside the window.
  const affected = await db
    .selectDistinct({ programId: schema.programSnapshots.programId })
    .from(schema.programSnapshots)
    .where(gt(schema.programSnapshots.capturedAt, cutoff));
  if (!affected.length) return [];
  const programIds = affected.map((r) => r.programId);

  // 2. All snapshots for those programs, ordered so we can walk (prev, cur) pairs.
  // ponytail: fetches every snapshot for every affected program. Fine at current scale
  // (~50-200 affected programs × <30 snapshots each). Switch to a window function join
  // if this ever pulls > ~50k rows.
  const snaps = await db
    .select({
      programId: schema.programSnapshots.programId,
      capturedAt: schema.programSnapshots.capturedAt,
      payload: schema.programSnapshots.payload,
    })
    .from(schema.programSnapshots)
    .where(inArray(schema.programSnapshots.programId, programIds))
    .orderBy(schema.programSnapshots.programId, schema.programSnapshots.capturedAt);

  // Only the columns RecentChange consumers actually read. Selecting the whole row pulled the
  // large `raw` source-JSON per program, which pushed the cached result past Next's 2MB
  // unstable_cache ceiling (~7MB) — so it failed to cache and re-queried on every request.
  const programs = await db
    .select({
      id: schema.programs.id,
      name: schema.programs.name,
      platform: schema.programs.platform,
      slug: schema.programs.slug,
      programType: schema.programs.programType,
      offersBounty: schema.programs.offersBounty,
      minBounty: schema.programs.minBounty,
      maxBounty: schema.programs.maxBounty,
      currency: schema.programs.currency,
      safeHarbor: schema.programs.safeHarbor,
      url: schema.programs.url,
    })
    .from(schema.programs)
    .where(inArray(schema.programs.id, programIds));
  const byId = new Map(programs.map((p) => [p.id, p]));

  // 3. Walk consecutive pairs; emit non-empty diffs whose cur.capturedAt is inside the window.
  const out: RecentChange[] = [];
  let currentProgram: number | null = null;
  let prevPayload: SnapshotPayloadShape | null = null;
  for (const s of snaps) {
    if (currentProgram !== s.programId) {
      currentProgram = s.programId;
      prevPayload = null;
    }
    const curPayload = s.payload as SnapshotPayloadShape;
    if (prevPayload && s.capturedAt > cutoff) {
      const diff = diffSnapshots(prevPayload, curPayload);
      if (diff && !isEmptyDiff(diff)) {
        const program = byId.get(s.programId);
        if (program) out.push({ program, capturedAt: s.capturedAt, diff });
      }
    }
    prevPayload = curPayload;
  }

  out.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
  return out.slice(0, limit);
}

// --- Public read exports: DB first, upstream fallback on any failure. ---
// Each wrapped in unstable_cache so repeated page views don't re-hit the DB.
// Ingest cron busts via revalidateTag(PROGRAMS_CACHE_TAG) after writes.
// Degraded reads bypass the cache. unstable_cache persists whatever withFallback returns, so a
// fallback result produced during an outage would be cached as if it were real DB data and served
// for up to CACHE_REVALIDATE after the DB recovered. Once the breaker is open we skip the cache and
// serve fresh fallback directly (which has its own in-memory store + Next fetch cache, so it's
// cheap) — nothing stale is ever written. Healthy path is unchanged: the cached DB read.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function degradable<Args extends any[], R>(
  dbFn: (...a: Args) => Promise<R>,
  fbFn: (...a: Args) => Promise<R>,
  keys: string[],
  label: string,
): (...a: Args) => Promise<R> {
  const cached = cachedWithDates(
    (...a: Args) => withFallback(() => dbFn(...a), () => fbFn(...a), label),
    keys,
    { revalidate: CACHE_REVALIDATE, tags: [CACHE_TAG] },
  );
  return (...a: Args) => (isDbDegraded() ? fbFn(...a) : cached(...a));
}

export const listPrograms = degradable(
  (f: ProgramFilters = {}) => listProgramsDb(f),
  (f: ProgramFilters = {}) => listProgramsFallback(f),
  ['listPrograms'],
  'listPrograms',
);
export const getProgramsByIds = degradable(getProgramsByIdsDb, getProgramsByIdsFallback, ['getProgramsByIds'], 'getProgramsByIds');
export const getProgramBySlug = degradable(getProgramBySlugDb, getProgramBySlugFallback, ['getProgramBySlug'], 'getProgramBySlug');
export const findByDomain = degradable(findByDomainDb, findByDomainFallback, ['findByDomain'], 'findByDomain');
export const topPayouts = degradable((limit = 5) => topPayoutsDb(limit), (limit = 5) => topPayoutsFallback(limit), ['topPayouts'], 'topPayouts');
export const stats = degradable(statsDb, statsFallback, ['stats'], 'stats');

// Total MCP requests served (all-time count of logged calls). Real usage signal for the
// homepage heartbeat. Best-effort: returns 0 on any error (incl. the table not existing
// yet) so a missing mcp_hits never breaks the home page.
export async function mcpTotalRequests(): Promise<number> {
  try {
    const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(schema.mcpHits);
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

// A random sample of real in-scope identifiers for the hero's data-as-atmosphere backdrop.
// Domain-ish only (contains a dot, reasonable length) so the ghosted text reads as scope.
// Best-effort: [] on error, so the hero falls back to just the glow (never fabricated data).
export async function sampleScopeIdentifiers(limit = 48): Promise<string[]> {
  try {
    const rows = await db
      .select({ id: schema.scopes.identifier })
      .from(schema.scopes)
      .where(
        sql`${schema.scopes.inScope} = true and ${schema.scopes.identifier} like '%.%' and char_length(${schema.scopes.identifier}) between 4 and 48`,
      )
      .orderBy(sql`random()`)
      .limit(limit);
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}

// Public read-only aggregate. Kept here (not in app/actions/reports.ts which is 'use server')
// so a server-component page can import it without the whole page becoming a server-action
// consumer — which Next.js opts out of static/ISR rendering.
export async function getProgramReportStats(programId: number): Promise<ProgramReportStats> {
  const MIN_STATS_SAMPLE = 3;
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      waiting: sql<number>`count(*) filter (where ${schema.userReports.firstResponseAt} is null)::int`,
      answered: sql<number>`count(*) filter (where ${schema.userReports.firstResponseAt} is not null)::int`,
      median: sql<number | null>`percentile_cont(0.5) within group (order by extract(epoch from ${schema.userReports.firstResponseAt} - ${schema.userReports.submittedAt}) / 86400) filter (where ${schema.userReports.firstResponseAt} is not null)`,
    })
    .from(schema.userReports)
    .where(eq(schema.userReports.programId, programId));

  const answered = row?.answered ?? 0;
  const median = row?.median ?? null;
  return {
    count: row?.count ?? 0,
    waitingCount: row?.waiting ?? 0,
    medianFirstResponseDays:
      answered >= MIN_STATS_SAMPLE && median !== null ? Math.round(median * 10) / 10 : null,
  };
}
