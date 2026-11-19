import { db, schema } from '@/lib/db/client';
import { eq, desc } from 'drizzle-orm';
import { createHash } from 'node:crypto';

// Standoff 365 ingest — first-party scrape of the Next.js __NEXT_DATA__ on the public programs page.
// Standoff 365 isn't in arkadiyt/bounty-targets-data, so this is a bespoke source like immunefi.ts /
// hackenproof.ts. Small platform (~20 public programs, Russian market), rewards denominated in RUB.
//
// Stage-1 only: program-level fields (name, vendor, stated max in RUB → USD, response-time stats).
// Scope (in-scope assets) lives on per-program detail pages and is deferred — these are Russian-market
// domains with low value to our audience, and the program listing is the coverage win. (follow-up:
// a stage-2 detail walk would add scope, mirroring immunefi's two-stage shape.)
//
// ponytail: HTML __NEXT_DATA__ scrape, not an API. Fragile if their SSR shape changes. Snapshotting
// deduplicates unchanged runs, so a bad parse is a no-op or one bad program, never a wipe.

const PLATFORM = 'standoff365';
const LIST_URL = 'https://bugbounty.standoff365.com/en-US/programs';
const UA = 'bounty.index-ingest/1.0';
// ponytail: static FX for ranking/display only; RUB drifts but a stated ceiling isn't precise anyway.
const RUB_TO_USD = 0.011;

interface Standoff365Statistics {
  rewards?: { rub?: { min?: number | null; max?: number | null } | null } | null;
  reportsTotal?: number | null;
  avgFirstResponseSeconds?: number | null;
}

interface Standoff365Program {
  slug?: string | null;
  name?: string | null;
  visibility?: string | null;
  status?: string | null;
  rewardKind?: string | null; // "money" = pays cash
  updatedAt?: string | null;
  vendor?: string | null | { name?: string | null };
  statistics?: Standoff365Statistics | null;
}

export interface NormalizedProgram {
  slug: string;
  name: string;
  vendor: string | null;
  url: string;
  offersBounty: boolean;
  maxBountyUsd: number | null;
  maxBountyRub: number | null;
  updatedAt: Date | null;
}

function vendorName(v: Standoff365Program['vendor']): string | null {
  if (!v) return null;
  return typeof v === 'string' ? v : v.name ?? null;
}

// Extract and parse the __NEXT_DATA__ JSON, returning the public published programs normalized.
export function parseStandoff365(html: string): NormalizedProgram[] {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return [];
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const programs = (data as { props?: { pageProps?: { programs?: Standoff365Program[] } } })?.props?.pageProps?.programs;
  if (!Array.isArray(programs)) return [];

  const out: NormalizedProgram[] = [];
  for (const p of programs) {
    if (!p.slug || !p.name) continue;
    if (p.visibility !== 'public' || p.status !== 'published') continue; // skip private / unpublished
    const rub = p.statistics?.rewards?.rub?.max ?? null;
    const maxBountyUsd = typeof rub === 'number' && rub > 0 ? Math.round(rub * RUB_TO_USD) : null;
    const offersBounty = p.rewardKind === 'money' && maxBountyUsd != null;
    const updated = p.updatedAt ? new Date(p.updatedAt) : null;
    out.push({
      slug: p.slug,
      name: p.name,
      vendor: vendorName(p.vendor),
      url: `${LIST_URL}/${p.slug}`,
      offersBounty,
      maxBountyUsd,
      maxBountyRub: typeof rub === 'number' ? rub : null,
      updatedAt: updated && !Number.isNaN(updated.getTime()) ? updated : null,
    });
  }
  return out;
}

interface SnapshotPayload {
  name: string;
  url: string;
  handle: string | null;
  programType: string;
  offersBounty: boolean;
  maxBounty: number | null;
  currency: string;
  vendor: string | null;
  scopeCount: number;
  inScopeCount: number;
  scopeIdentifiers: string[];
}

function buildSnapshotPayload(p: NormalizedProgram): SnapshotPayload {
  return {
    name: p.name,
    url: p.url,
    handle: p.slug,
    programType: p.offersBounty ? 'bounty' : 'vdp',
    offersBounty: p.offersBounty,
    maxBounty: p.maxBountyUsd,
    currency: 'USD',
    vendor: p.vendor,
    scopeCount: 0,
    inScopeCount: 0,
    scopeIdentifiers: [],
  };
}

async function upsertSource(): Promise<number> {
  const [row] = await db
    .insert(schema.sources)
    .values({ name: PLATFORM, url: LIST_URL })
    .onConflictDoUpdate({ target: schema.sources.name, set: { url: LIST_URL } })
    .returning({ id: schema.sources.id });
  return row.id;
}

async function maybeSnapshot(programId: number, ingestRunId: number, payload: SnapshotPayload): Promise<boolean> {
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const [latest] = await db
    .select({ contentHash: schema.programSnapshots.contentHash })
    .from(schema.programSnapshots)
    .where(eq(schema.programSnapshots.programId, programId))
    .orderBy(desc(schema.programSnapshots.capturedAt))
    .limit(1);
  if (latest && latest.contentHash === hash) return false;
  await db.insert(schema.programSnapshots).values({ programId, ingestRunId, contentHash: hash, payload });
  return true;
}

export interface Result {
  platform: string;
  programsUpserted: number;
  snapshotsWritten: number;
}

export async function ingestStandoff365(): Promise<Result> {
  const sourceId = await upsertSource();
  const [run] = await db.insert(schema.ingestRuns).values({ sourceId }).returning({ id: schema.ingestRuns.id });
  let programsUpserted = 0;
  let snapshotsWritten = 0;

  try {
    const res = await fetch(LIST_URL, {
      cache: 'no-store',
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const programs = parseStandoff365(html);
    if (programs.length === 0) throw new Error('0 programs parsed — Standoff365 __NEXT_DATA__ shape may have changed');

    for (const p of programs) {
      const raw: Record<string, unknown> = { maxBountyRub: p.maxBountyRub, vendor: p.vendor };
      const now = p.updatedAt ?? new Date();
      const [prog] = await db
        .insert(schema.programs)
        .values({
          slug: p.slug,
          platform: PLATFORM,
          name: p.name,
          handle: p.slug,
          url: p.url,
          programType: p.offersBounty ? 'bounty' : 'vdp',
          offersBounty: p.offersBounty,
          maxBounty: p.maxBountyUsd,
          currency: 'USD',
          lastUpdatedAt: now,
          raw,
          searchText: [p.name, p.vendor ?? '', p.slug].join(' '),
        })
        .onConflictDoUpdate({
          target: [schema.programs.platform, schema.programs.slug],
          set: {
            name: p.name,
            url: p.url,
            handle: p.slug,
            programType: p.offersBounty ? 'bounty' : 'vdp',
            offersBounty: p.offersBounty,
            maxBounty: p.maxBountyUsd,
            lastUpdatedAt: now,
            raw,
          },
        })
        .returning({ id: schema.programs.id });
      programsUpserted++;
      if (await maybeSnapshot(prog.id, run.id, buildSnapshotPayload(p))) snapshotsWritten++;
    }

    await db
      .update(schema.ingestRuns)
      .set({ status: 'ok', finishedAt: new Date(), programsUpserted })
      .where(eq(schema.ingestRuns.id, run.id));
    await db
      .update(schema.sources)
      .set({ lastRunAt: new Date(), lastStatus: 'ok', lastError: null })
      .where(eq(schema.sources.id, sourceId));
    return { platform: PLATFORM, programsUpserted, snapshotsWritten };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.ingestRuns)
      .set({ status: 'error', finishedAt: new Date(), error: message })
      .where(eq(schema.ingestRuns.id, run.id));
    await db
      .update(schema.sources)
      .set({ lastRunAt: new Date(), lastStatus: 'error', lastError: message })
      .where(eq(schema.sources.id, sourceId));
    throw err;
  }
}

// ponytail self-check: `npx tsx lib/ingest/standoff365.ts` (pure parser, DB offline).
if (require.main === module) {
  const nextData = JSON.stringify({
    props: {
      pageProps: {
        programs: [
          { slug: 'acme', name: 'Acme', visibility: 'public', status: 'published', rewardKind: 'money', vendor: { name: 'Acme Inc' }, statistics: { rewards: { rub: { min: 0, max: 100000 } } } },
          { slug: 'priv', name: 'Private', visibility: 'private', status: 'published', rewardKind: 'money', statistics: { rewards: { rub: { max: 50000 } } } },
          { slug: 'vdp', name: 'VDP Only', visibility: 'public', status: 'published', rewardKind: 'reputation', vendor: 'SomeCorp', statistics: { rewards: { rub: { max: 0 } } } },
        ],
      },
    },
  });
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${nextData}</script></html>`;
  const parsed = parseStandoff365(html);
  const acme = parsed.find((p) => p.slug === 'acme');
  const vdp = parsed.find((p) => p.slug === 'vdp');
  const checks: Array<[string, boolean]> = [
    ['drops private program', !parsed.some((p) => p.slug === 'priv')],
    ['keeps public published', parsed.length === 2],
    ['RUB max → USD', acme?.maxBountyUsd === Math.round(100000 * RUB_TO_USD)],
    ['money reward → offersBounty', acme?.offersBounty === true],
    ['vendor object name extracted', acme?.vendor === 'Acme Inc'],
    ['vendor string passthrough', vdp?.vendor === 'SomeCorp'],
    ['no reward → not offersBounty', vdp?.offersBounty === false],
    ['empty html → []', parseStandoff365('<html></html>').length === 0],
  ];
  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'ok ' : 'FAIL'} ${name}`);
    if (!pass) ok = false;
  }
  console.log(ok ? 'standoff365 self-check passed' : 'FAILURES');
  if (!ok) process.exit(1);
}
