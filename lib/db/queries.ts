import { db, schema } from './client';
import { and, or, eq, ilike, gte, gt, isNotNull, desc, sql, inArray, ne } from 'drizzle-orm';
import { diffSnapshots, isEmptyDiff, type SnapshotDiff } from '../snapshots';
import {
  listProgramsFallback,
  getProgramBySlugFallback,
  findByDomainFallback,
  statsFallback,
  topPayoutsFallback,
  getProgramsByIdsFallback,
} from '@/lib/fallback/upstream';

// Read-only fallback: on any DB error (Neon quota, cold-start timeout, credential drift),
// serve reconstructed data from arkadiyt/bounty-targets-data so the site stays browsable.
// Only wraps read paths that can be rebuilt from upstream; snapshot-history features
// (whats-new, feed's firstSeenAt) and per-user tables intentionally still throw.
async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>, label: string): Promise<T> {
  try {
    return await primary();
  } catch (err) {
    console.error(`[db-fallback] ${label} → upstream:`, err instanceof Error ? err.message : err);
    return fallback();
  }
}

export type ProgramFilters = {
  q?: string;
  platform?: string[];
  assetType?: string[];
  programType?: string; // bounty | vdp | all
  minReward?: number;
  hasBounty?: boolean;
  safeHarbor?: boolean; // true = only programs with confirmed safe harbor (full or partial)
  sort?: 'newest' | 'reward' | 'name';
  page?: number;
  pageSize?: number;
};

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

  const finalWhere = programIdsByAsset ? and(where, inArray(schema.programs.id, programIdsByAsset)) : where;

  // When a search term is present, always sort by relevance first, then fall back to the user's chosen sort.
  const secondarySort =
    f.sort === 'reward'
      ? sql`${schema.programs.maxBounty} DESC NULLS LAST`
      : f.sort === 'name'
        ? schema.programs.name
        : sql`${schema.programs.firstSeenAt} DESC NULLS LAST`;
  const orderBy = q
    ? sql`similarity(${schema.programs.searchText}, ${q}) DESC, ${secondarySort}`
    : secondarySort;

  const [rows, totalRow] = await Promise.all([
    db.select().from(schema.programs).where(finalWhere).orderBy(orderBy).limit(pageSize).offset(offset),
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

export async function newestPrograms(limit = 50) {
  return db.select().from(schema.programs).where(isNotNull(schema.programs.firstSeenAt)).orderBy(desc(schema.programs.firstSeenAt)).limit(limit);
}

// Programs first seen within the last `days` days, most recent first.
export async function recentlyAdded(limit = 8, days = 14) {
  return db
    .select()
    .from(schema.programs)
    .where(sql`${schema.programs.firstSeenAt} > now() - ${sql.raw(`interval '${days} days'`)}`)
    .orderBy(desc(schema.programs.firstSeenAt))
    .limit(limit);
}

// "Trending" v1: highest payouts among recent additions. Real trending arrives when snapshot history has ≥ 2 weeks of data.
export async function trendingNewPayouts(limit = 6, days = 30) {
  return db
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
    .limit(limit);
}

// Watchlist data: each program + its two most recent snapshot payloads for diff computation.
export interface WatchlistEntry {
  program: typeof schema.programs.$inferSelect;
  latest: SnapshotPayloadShape | null;
  previous: SnapshotPayloadShape | null;
  latestAt: Date | null;
}

// Shape of the payload we write in lib/ingest/bounty-targets.ts::buildSnapshotPayload.
// Kept as an interface (not imported) so queries.ts stays free of ingest coupling.
export interface SnapshotPayloadShape {
  name: string;
  url: string;
  handle: string | null;
  programType: string;
  offersBounty: boolean;
  offersSwag: boolean;
  managed: boolean;
  minBounty: number | null;
  maxBounty: number | null;
  currency: string;
  submissionState: string | null;
  safeHarbor: string | null;
  scopeCount: number;
  inScopeCount: number;
  scopeIdentifiers: string[];
}

// Full snapshot history for a single program, oldest → newest so callers can build a timeline.
export interface ProgramSnapshot {
  capturedAt: Date;
  payload: SnapshotPayloadShape;
}

// Similar programs by count of shared in-scope identifiers. Naive exact-match count — good
// enough as a first pass because company-specific identifiers (*.shopify.com etc.) are unique
// to their owner. If noise creeps in later, filter out identifiers with very high global counts.
export interface SimilarProgram {
  program: typeof schema.programs.$inferSelect;
  overlap: number;
}

export async function getSimilarPrograms(programId: number, limit = 5): Promise<SimilarProgram[]> {
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

export async function getProgramSnapshots(programId: number): Promise<ProgramSnapshot[]> {
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
export interface RecentChange {
  program: typeof schema.programs.$inferSelect;
  capturedAt: Date;
  diff: SnapshotDiff;
}

export async function getRecentChanges(hoursBack = 168, limit = 200): Promise<RecentChange[]> {
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

  const programs = await db.select().from(schema.programs).where(inArray(schema.programs.id, programIds));
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
export const listPrograms = (f: ProgramFilters = {}) =>
  withFallback(() => listProgramsDb(f), () => listProgramsFallback(f), 'listPrograms');
export const getProgramsByIds = (ids: number[]) =>
  withFallback(() => getProgramsByIdsDb(ids), () => getProgramsByIdsFallback(ids), 'getProgramsByIds');
export const getProgramBySlug = (platform: string, slug: string) =>
  withFallback(() => getProgramBySlugDb(platform, slug), () => getProgramBySlugFallback(platform, slug), 'getProgramBySlug');
export const findByDomain = (domain: string) =>
  withFallback(() => findByDomainDb(domain), () => findByDomainFallback(domain), 'findByDomain');
export const topPayouts = (limit = 5) =>
  withFallback(() => topPayoutsDb(limit), () => topPayoutsFallback(limit), 'topPayouts');
export const stats = () => withFallback(() => statsDb(), () => statsFallback(), 'stats');
