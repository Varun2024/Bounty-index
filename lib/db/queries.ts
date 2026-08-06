import { db, schema } from './client';
import { and, or, eq, ilike, gte, isNotNull, desc, sql, inArray, ne } from 'drizzle-orm';

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

export async function listPrograms(f: ProgramFilters = {}) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 25));
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

export async function getProgramsByIds(ids: number[]) {
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

export async function getProgramBySlug(platform: string, slug: string) {
  const [program] = await db
    .select()
    .from(schema.programs)
    .where(and(eq(schema.programs.platform, platform), eq(schema.programs.slug, slug)))
    .limit(1);
  if (!program) return null;
  const scopeRows = await db.select().from(schema.scopes).where(eq(schema.scopes.programId, program.id));
  return { program, scopes: scopeRows };
}

export async function findByDomain(domain: string) {
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

export async function topPayouts(limit = 5) {
  return db
    .select()
    .from(schema.programs)
    .where(and(eq(schema.programs.offersBounty, true), isNotNull(schema.programs.maxBounty)))
    .orderBy(sql`${schema.programs.maxBounty} DESC NULLS LAST`)
    .limit(limit);
}

export async function stats() {
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
