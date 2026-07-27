import { db, schema } from './client';
import { and, or, eq, ilike, gte, isNotNull, desc, sql, inArray } from 'drizzle-orm';

export type ProgramFilters = {
  q?: string;
  platform?: string[];
  assetType?: string[];
  programType?: string; // bounty | vdp | all
  minReward?: number;
  hasBounty?: boolean;
  sort?: 'newest' | 'reward' | 'name';
  page?: number;
  pageSize?: number;
};

export async function listPrograms(f: ProgramFilters = {}) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const where = and(
    f.q ? ilike(schema.programs.searchText, `%${f.q}%`) : undefined,
    f.platform?.length ? inArray(schema.programs.platform, f.platform) : undefined,
    f.programType && f.programType !== 'all' ? eq(schema.programs.programType, f.programType) : undefined,
    f.hasBounty ? eq(schema.programs.offersBounty, true) : undefined,
    f.minReward ? gte(schema.programs.maxBounty, f.minReward) : undefined,
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

  const orderBy =
    f.sort === 'reward'
      ? sql`${schema.programs.maxBounty} DESC NULLS LAST`
      : f.sort === 'name'
        ? schema.programs.name
        : sql`${schema.programs.firstSeenAt} DESC NULLS LAST`;

  const [rows, totalRow] = await Promise.all([
    db.select().from(schema.programs).where(finalWhere).orderBy(orderBy).limit(pageSize).offset(offset),
    db.select({ c: sql<number>`count(*)::int` }).from(schema.programs).where(finalWhere),
  ]);

  return { rows, total: totalRow[0]?.c ?? 0, page, pageSize };
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
    .where(
      and(
        eq(schema.scopes.inScope, true),
        or(ilike(schema.scopes.identifier, `%${d}%`), ilike(schema.scopes.identifier, `%*.${d}%`)),
      ),
    )
    .limit(200);
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
