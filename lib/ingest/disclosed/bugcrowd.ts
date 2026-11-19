import { db, schema } from '@/lib/db/client';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

// Bugcrowd CrowdStream disclosed-reports ingest (PLAN_DISCLOSED_REPORTS Phase 4).
//
// Mirrors the H1 disclosed ingest: append-only, INSERT-IF-NEW on (platform, external_id), the one
// public record of what Bugcrowd programs actually pay. Differences from H1:
//   - Source is the public CrowdStream JSON feed the activity page itself calls (page-based, not a
//     GraphQL cursor). Verified 2026-11-19: honest UA accepted, 1271 rows / 64 pages, full history.
//   - Reward visibility is RESEARCHER-CONTROLLED: `amount` ("$1,000") counts only when
//     `crowdstream_amount_visible` is true; researcher name only when `crowdstream_name_visible`.
//     We never infer a hidden amount (honesty rule 9). ~1 in 9 rows carries a public amount.
//   - Programs map by SLUG, not handle: CrowdStream gives the bare `engagement_code` (e.g.
//     "mastercard"), while our bugcrowd slugs are a mix of bare and `engagements/`-prefixed, so we
//     try both forms. Unmapped rows store the raw code and relink on a later run (same as H1).
//
// Bounded per run (ponytail): walk newest-first, stop as soon as a page inserts nothing new.
// onConflictDoNothing makes page overlaps harmless. First run backfills up to MAX_PAGES.

const PLATFORM = 'bugcrowd';
const SOURCE_NAME = 'bugcrowd-disclosed';
const FEED_URL = 'https://bugcrowd.com/crowdstream.json';
const CROWDSTREAM_URL = 'https://bugcrowd.com/crowdstream';
const UA = 'bounty.index-ingest/1.0';
const MAX_PAGES = 20; // 20 rows/page → ~400/run cap; ingestAll runs sources in series under Vercel's 300s.
const PAGE_DELAY_MS = 300; // polite rate limiting, same spirit as the H1 ingest.

const HEADERS = { 'user-agent': UA, accept: 'application/json' };

// Bugcrowd priority P1..P5 → our lowercase severity vocab (shared with H1's severity_rating).
const SEVERITY_BY_PRIORITY: Record<number, string> = {
  1: 'critical',
  2: 'high',
  3: 'medium',
  4: 'low',
  5: 'informational',
};

interface CrowdStreamItem {
  id?: string | null;
  engagement_code?: string | null;
  engagement_name?: string | null;
  priority?: number | null;
  substate?: string | null;
  created_at?: string | null;
  target?: string | null;
  researcher_username?: string | null;
  crowdstream_name_visible?: boolean | null;
  amount?: string | null; // formatted, e.g. "$1,000" — only meaningful when *_amount_visible
  crowdstream_amount_visible?: boolean | null;
}

type Row = typeof schema.disclosedReports.$inferInsert;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Parse a CrowdStream amount string ("$1,000") to a positive integer, ONLY when the researcher made
// it visible. null means not disclosed — never 0 (honors hide-amount choices, honesty rule 9).
export function parseAmount(raw: string | null | undefined, visible: boolean | null | undefined): number | null {
  if (!visible || typeof raw !== 'string') return null;
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function severityFromPriority(p: number | null | undefined): string | null {
  return typeof p === 'number' ? SEVERITY_BY_PRIORITY[p] ?? null : null;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// An item → an insertable row, or null when it isn't usable (no id or no creation date to satisfy
// the NOT NULL disclosed_at). programId is resolved by the caller.
function toRow(it: CrowdStreamItem): Row | null {
  const externalId = it.id;
  const disclosedAt = parseDate(it.created_at);
  if (!externalId || !disclosedAt) return null;
  const amount = parseAmount(it.amount, it.crowdstream_amount_visible);
  const researcher = it.crowdstream_name_visible ? it.researcher_username ?? null : null;
  const canonical = JSON.stringify([
    String(externalId),
    it.target ?? null,
    it.priority ?? null,
    amount,
    it.created_at ?? null,
  ]);
  return {
    platform: PLATFORM,
    externalId: String(externalId),
    programHandle: it.engagement_code ?? null, // raw code, used by relink (slug may be prefixed)
    title: it.target ?? it.engagement_name ?? null,
    severity: severityFromPriority(it.priority),
    bountyAmount: amount,
    currency: amount != null ? 'USD' : null, // CrowdStream amounts render in USD ("$…")
    disclosedAt,
    researcher,
    contentHash: createHash('sha256').update(canonical).digest('hex'),
    payload: it as unknown as Record<string, unknown>,
  };
}

async function fetchPage(page: number): Promise<CrowdStreamItem[]> {
  const res = await fetch(`${FEED_URL}?page=${page}`, {
    cache: 'no-store',
    headers: HEADERS,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json().catch(() => null)) as { results?: CrowdStreamItem[] } | null;
  if (!json || !Array.isArray(json.results)) throw new Error('unexpected shape (results missing)');
  return json.results;
}

async function upsertSource(): Promise<number> {
  const [row] = await db
    .insert(schema.sources)
    .values({ name: SOURCE_NAME, url: CROWDSTREAM_URL })
    .onConflictDoUpdate({ target: schema.sources.name, set: { url: CROWDSTREAM_URL } })
    .returning({ id: schema.sources.id });
  return row.id;
}

// engagement_code → programs.id for every bugcrowd program, resolved once per run. Our slugs are a
// mix of bare ("k15t") and "engagements/"-prefixed ("engagements/asana"); CrowdStream gives the bare
// code, so index both forms. Returns a lookup that tries bare then prefixed.
async function loadSlugLookup(): Promise<(code: string) => number | null> {
  const rows = await db
    .select({ slug: schema.programs.slug, id: schema.programs.id })
    .from(schema.programs)
    .where(eq(schema.programs.platform, PLATFORM));
  const bySlug = new Map<string, number>();
  for (const r of rows) if (r.slug) bySlug.set(r.slug, r.id);
  return (code: string) => bySlug.get(code) ?? bySlug.get(`engagements/${code}`) ?? null;
}

// Backlink rows ingested before their program existed (or before the slug matched). Matches the raw
// engagement_code against slug in either form. One bulk UPDATE per run; only touches unmapped rows.
async function relinkUnmapped(): Promise<number> {
  const res = await db.execute(sql`
    UPDATE disclosed_reports dr
    SET program_id = p.id
    FROM programs p
    WHERE dr.program_id IS NULL
      AND dr.platform = ${PLATFORM}
      AND p.platform = ${PLATFORM}
      AND (p.slug = dr.program_handle OR p.slug = 'engagements/' || dr.program_handle)
    RETURNING dr.id
  `);
  return (res as unknown as { rows?: unknown[] }).rows?.length ?? 0;
}

export interface DisclosedIngestResult {
  platform: string;
  reportsInserted: number;
  nodesSeen: number;
  disclosedSeen: number;
  withAmount: number;
  mappedToProgram: number;
  relinked: number;
  pagesWalked: number;
}

export async function ingestBugcrowdDisclosed(): Promise<DisclosedIngestResult> {
  const sourceId = await upsertSource();
  const [run] = await db.insert(schema.ingestRuns).values({ sourceId }).returning({ id: schema.ingestRuns.id });

  let reportsInserted = 0;
  let nodesSeen = 0;
  let disclosedSeen = 0;
  let withAmount = 0;
  let mappedToProgram = 0;
  let relinked = 0;
  let pagesWalked = 0;

  try {
    const lookup = await loadSlugLookup();

    for (let page = 1; page <= MAX_PAGES; page++) {
      if (page > 1) await sleep(PAGE_DELAY_MS);
      const items = await fetchPage(page);
      pagesWalked++;
      nodesSeen += items.length;
      if (items.length === 0) break;

      const rows: Row[] = [];
      for (const it of items) {
        const row = toRow(it);
        if (!row) continue;
        disclosedSeen++;
        if (row.bountyAmount !== null) withAmount++;
        const pid = row.programHandle ? lookup(row.programHandle) : null;
        if (pid) mappedToProgram++;
        rows.push(pid ? { ...row, programId: pid } : row);
      }

      // Drift alarm (plan §6): a full page yielding zero buildable rows means the feed shape moved.
      if (items.length > 0 && rows.length === 0 && disclosedSeen === 0) {
        throw new Error(`0 disclosed rows built from ${items.length} items on page ${page} — CrowdStream shape may have changed`);
      }

      let insertedThisPage = 0;
      if (rows.length > 0) {
        const inserted = await db
          .insert(schema.disclosedReports)
          .values(rows)
          .onConflictDoNothing({ target: [schema.disclosedReports.platform, schema.disclosedReports.externalId] })
          .returning({ id: schema.disclosedReports.id });
        insertedThisPage = inserted.length;
        reportsInserted += insertedThisPage;
      }

      if (insertedThisPage === 0) break; // caught up to a prior run (everything on this page already stored).
    }

    relinked = await relinkUnmapped();

    await db
      .update(schema.ingestRuns)
      .set({ status: 'ok', finishedAt: new Date(), programsUpserted: reportsInserted })
      .where(eq(schema.ingestRuns.id, run.id));
    await db
      .update(schema.sources)
      .set({ lastRunAt: new Date(), lastStatus: 'ok', lastError: null })
      .where(eq(schema.sources.id, sourceId));

    return { platform: SOURCE_NAME, reportsInserted, nodesSeen, disclosedSeen, withAmount, mappedToProgram, relinked, pagesWalked };
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

// ponytail self-check: `npx tsx lib/ingest/disclosed/bugcrowd.ts` (pure parsers, DB offline).
if (require.main === module) {
  const checks: Array<[string, boolean]> = [
    ['visible $1,000 → 1000', parseAmount('$1,000', true) === 1000],
    ['hidden amount → null', parseAmount('$1,000', false) === null],
    ['missing amount → null', parseAmount(null, true) === null],
    ['zero → null', parseAmount('$0', true) === null],
    ['P1 → critical', severityFromPriority(1) === 'critical'],
    ['P5 → informational', severityFromPriority(5) === 'informational'],
    ['unknown priority → null', severityFromPriority(9) === null],
    ['null priority → null', severityFromPriority(null) === null],
  ];
  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'ok ' : 'FAIL'} ${name}`);
    if (!pass) ok = false;
  }
  console.log(ok ? 'bugcrowd disclosed self-check passed' : 'FAILURES');
  if (!ok) process.exit(1);
}
