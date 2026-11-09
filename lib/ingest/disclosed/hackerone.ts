import { db, schema } from '@/lib/db/client';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

// HackerOne Hacktivity disclosed-reports ingest (PLAN_DISCLOSED_REPORTS Phase 1).
//
// The one public record of what programs ACTUALLY pay + how fast they respond — data the
// arkadiyt mirror can't have. Reports are immutable once disclosed, so this is INSERT-IF-NEW
// (onConflictDoNothing on (platform, external_id)), NOT the hash-vs-latest compare maybeSnapshot
// uses for mutable program state.
//
// Source: HackerOne's public GraphQL endpoint — the same one the Hacktivity web UI calls. Not an
// official API; the shape can change. Verified working 2026-11-04 (see probe in commit history):
//   - Honest UA is accepted (no browser-header spoofing needed) — honesty rule holds.
//   - disclosed_at is only selectable WITHOUT the substate filter, so we page in "sort-only" mode
//     (query: {bool: {}}) sorted disclosed_at DESC — which IS the disclosure feed, newest first.
//   - total_awarded_amount came back numeric; severity_rating is capitalised ("Medium").
//   - `report` is null for not-yet-disclosed items (they sort last) — we skip those.
//
// Bounded per run (ponytail): walk newest-first, insert-if-new, stop as soon as a page adds nothing
// new (we've caught up to prior runs). First-ever run backfills up to MAX_PAGES; a daily run after
// that typically stops on page 1-2. onConflictDoNothing makes page overlaps harmless.

const PLATFORM = 'hackerone';
const SOURCE_NAME = 'hackerone-disclosed';
const GRAPHQL_URL = 'https://hackerone.com/graphql';
const HACKTIVITY_URL = 'https://hackerone.com/hacktivity';
const UA = 'bounty.index-ingest/1.0';
const PAGE_SIZE = 50;
const MAX_PAGES = 20; // ~1000 reports/run cap; ingestAll runs every source in series under Vercel's 300s.
const PAGE_DELAY_MS = 300; // polite rate limiting, same spirit as h1grep.

const HEADERS = { 'content-type': 'application/json', 'user-agent': UA, accept: 'application/json' };

const REPORT_FIELDS = `... on HacktivityDocument {
  severity_rating
  total_awarded_amount
  currency
  votes
  disclosed_at
  team { handle name }
  reporter { username }
  report { _id title url }
}`;

function pageQuery(after: string | null): string {
  const afterStr = after ? `, after: ${JSON.stringify(after)}` : '';
  return `{ search(index: CompleteHacktivityReportIndex, query: {bool: {}}, first: ${PAGE_SIZE}${afterStr}, sort: {field: "disclosed_at", direction: DESC}) { pageInfo { endCursor } nodes { ${REPORT_FIELDS} } } }`;
}

interface H1Node {
  severity_rating?: string | null;
  total_awarded_amount?: number | string | null;
  currency?: string | null;
  votes?: number | null;
  disclosed_at?: string | null;
  team?: { handle?: string | null; name?: string | null } | null;
  reporter?: { username?: string | null } | null;
  report?: { _id?: string | null; title?: string | null; url?: string | null } | null;
}

type Row = typeof schema.disclosedReports.$inferInsert;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseAmount(v: unknown): number | null {
  if (typeof v === 'number') return v > 0 ? Math.round(v) : null;
  if (typeof v === 'string') {
    const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null; // null/absent = not disclosed, never 0 (honor hide-amount choices).
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// A node → an insertable row, or null when it isn't a usable disclosed report (no public report,
// or no disclosure date to satisfy the NOT NULL column). programId is resolved by the caller.
function toRow(n: H1Node): Row | null {
  const report = n.report;
  const externalId = report?._id;
  const disclosedAt = parseDate(n.disclosed_at);
  if (!report || !externalId || !disclosedAt) return null;
  const amount = parseAmount(n.total_awarded_amount);
  const canonical = JSON.stringify([
    String(externalId),
    report.title ?? null,
    n.severity_rating ?? null,
    amount,
    n.currency ?? null,
    n.disclosed_at ?? null,
  ]);
  return {
    platform: PLATFORM,
    externalId: String(externalId),
    programHandle: n.team?.handle ?? null,
    title: report.title ?? null,
    severity: n.severity_rating ? n.severity_rating.toLowerCase() : null,
    bountyAmount: amount,
    currency: n.currency ?? null,
    disclosedAt,
    researcher: n.reporter?.username ?? null,
    contentHash: createHash('sha256').update(canonical).digest('hex'),
    payload: n as unknown as Record<string, unknown>,
  };
}

async function fetchPage(after: string | null): Promise<{ nodes: H1Node[]; endCursor: string | null }> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    cache: 'no-store',
    headers: HEADERS,
    body: JSON.stringify({ query: pageQuery(after) }),
    // Bound every page: a stalled H1 connection must not eat the cron's remaining budget.
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json().catch(() => null)) as
    | { data?: { search?: { nodes?: H1Node[]; pageInfo?: { endCursor?: string | null } } }; errors?: Array<{ message?: string }> }
    | null;
  if (!json || json.errors) {
    throw new Error(`GraphQL error: ${json?.errors?.map((e) => e.message).join('; ') ?? 'non-JSON response'}`);
  }
  const search = json.data?.search;
  if (!search || !Array.isArray(search.nodes)) throw new Error('unexpected shape (search/nodes missing)');
  return { nodes: search.nodes, endCursor: search.pageInfo?.endCursor ?? null };
}

async function upsertSource(): Promise<number> {
  const [row] = await db
    .insert(schema.sources)
    .values({ name: SOURCE_NAME, url: HACKTIVITY_URL })
    .onConflictDoUpdate({ target: schema.sources.name, set: { url: HACKTIVITY_URL } })
    .returning({ id: schema.sources.id });
  return row.id;
}

// handle → programs.id for every HackerOne program, resolved once per run.
async function loadHandleMap(): Promise<Map<string, number>> {
  const rows = await db
    .select({ handle: schema.programs.handle, id: schema.programs.id })
    .from(schema.programs)
    .where(eq(schema.programs.platform, PLATFORM));
  const m = new Map<string, number>();
  for (const r of rows) if (r.handle) m.set(r.handle, r.id);
  return m;
}

export interface DisclosedIngestResult {
  platform: string;
  reportsInserted: number;
  nodesSeen: number;
  disclosedSeen: number; // nodes that are actually disclosed reports (built into rows)
  withAmount: number; // of disclosedSeen, how many carry a bounty amount
  mappedToProgram: number; // of disclosedSeen, how many resolved to one of our programs
  relinked: number; // prior-run reports whose program has since appeared and were linked this run
  pagesWalked: number;
}

// Backlink reports that were ingested before their program existed in `programs`. A report is
// stored even when its handle isn't in our index yet (programId stays null); once the program
// lands in a later program-ingest, this links it so real-payout aggregation stops missing it.
// One bulk UPDATE per run — cheap, and only touches the still-unmapped rows.
async function relinkUnmapped(): Promise<number> {
  const res = await db.execute(sql`
    UPDATE disclosed_reports dr
    SET program_id = p.id
    FROM programs p
    WHERE dr.program_id IS NULL
      AND dr.platform = ${PLATFORM}
      AND p.platform = ${PLATFORM}
      AND p.handle = dr.program_handle
    RETURNING dr.id
  `);
  return (res as unknown as { rows?: unknown[] }).rows?.length ?? 0;
}

export async function ingestHackeroneDisclosed(): Promise<DisclosedIngestResult> {
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
    const handleToId = await loadHandleMap();
    let cursor: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      if (page > 0) await sleep(PAGE_DELAY_MS);
      const { nodes, endCursor } = await fetchPage(cursor);
      pagesWalked++;
      nodesSeen += nodes.length;
      if (nodes.length === 0) break;

      const rows: Row[] = [];
      for (const n of nodes) {
        const row = toRow(n);
        if (!row) continue;
        disclosedSeen++;
        if (row.bountyAmount !== null) withAmount++;
        const pid = row.programHandle ? handleToId.get(row.programHandle) ?? null : null;
        if (pid) mappedToProgram++;
        rows.push(pid ? { ...row, programId: pid } : row);
      }

      // Drift alarm (plan §6): a full page of nodes that yields zero buildable rows means the
      // report/field shape likely moved. Fail loudly rather than silently ingesting nothing.
      if (nodes.length > 0 && rows.length === 0 && disclosedSeen === 0) {
        throw new Error(`0 disclosed rows built from ${nodes.length} nodes on page ${page + 1} — H1 shape may have changed`);
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

      cursor = endCursor;
      if (!cursor) break;
      if (insertedThisPage === 0) break; // caught up to a prior run (everything on this page already stored).
    }

    // After the walk, backlink any still-unmapped reports whose program now exists.
    relinked = await relinkUnmapped();

    await db
      .update(schema.ingestRuns)
      // reportsInserted reused into programsUpserted — this source has no "programs"; it's the one
      // persistent per-run count the admin surface already reads.
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
