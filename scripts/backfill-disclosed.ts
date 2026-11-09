import 'dotenv/config';
import { db, schema } from '../lib/db/client';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';

// One-time DEEP backfill of H1 Hacktivity disclosed reports.
//
// The prod ingester (lib/ingest/disclosed/hackerone.ts) stops as soon as a page adds 0 new rows,
// which is correct for a daily run but halts on page 1 against already-stored recent data — so it
// can never reach OLDER history. This walks the full cursor instead (no stop-on-zero), pulling the
// irreversible append-only corpus as deep as the endpoint serves. Additive only: same
// onConflictDoNothing on (platform, external_id), same toRow mapping as prod. Safe to re-run.
//
//   npx tsx scripts/backfill-disclosed.ts [maxPages]

const PLATFORM = 'hackerone';
const GRAPHQL_URL = 'https://hackerone.com/graphql';
const UA = 'bounty.index-ingest/1.0';
const PAGE_SIZE = 50;
const PAGE_DELAY_MS = 200;
const HEADERS = { 'content-type': 'application/json', 'user-agent': UA, accept: 'application/json' };

const REPORT_FIELDS = `... on HacktivityDocument {
  severity_rating total_awarded_amount currency votes disclosed_at
  team { handle name } reporter { username } report { _id title url }
}`;

function pageQuery(after: string | null): string {
  const a = after ? `, after: ${JSON.stringify(after)}` : '';
  return `{ search(index: CompleteHacktivityReportIndex, query: {bool: {}}, first: ${PAGE_SIZE}${a}, sort: {field: "disclosed_at", direction: DESC}) { pageInfo { endCursor } nodes { ${REPORT_FIELDS} } } }`;
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
  return null;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
  const res = await fetch(GRAPHQL_URL, { method: 'POST', cache: 'no-store', headers: HEADERS, body: JSON.stringify({ query: pageQuery(after) }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json().catch(() => null)) as
    | { data?: { search?: { nodes?: H1Node[]; pageInfo?: { endCursor?: string | null } } }; errors?: Array<{ message?: string }> }
    | null;
  if (!json || json.errors) throw new Error(`GraphQL error: ${json?.errors?.map((e) => e.message).join('; ') ?? 'non-JSON'}`);
  const search = json.data?.search;
  if (!search || !Array.isArray(search.nodes)) throw new Error('unexpected shape');
  return { nodes: search.nodes, endCursor: search.pageInfo?.endCursor ?? null };
}

async function main() {
  const maxPages = Number(process.argv[2]) || 400;
  const rows = await db
    .select({ handle: schema.programs.handle, id: schema.programs.id })
    .from(schema.programs)
    .where(eq(schema.programs.platform, PLATFORM));
  const handleToId = new Map<string, number>();
  for (const r of rows) if (r.handle) handleToId.set(r.handle, r.id);

  let cursor: string | null = null;
  let pages = 0, nodesSeen = 0, built = 0, inserted = 0, withAmount = 0, mapped = 0;
  let oldest = '9999', newest = '0';

  for (let p = 0; p < maxPages; p++) {
    if (p > 0) await sleep(PAGE_DELAY_MS);
    const { nodes, endCursor } = await fetchPage(cursor);
    pages++;
    nodesSeen += nodes.length;
    if (nodes.length === 0) break;

    const batch: Row[] = [];
    for (const n of nodes) {
      const row = toRow(n);
      if (!row) continue;
      built++;
      if (row.bountyAmount !== null) withAmount++;
      if (n.disclosed_at && n.disclosed_at < oldest) oldest = n.disclosed_at;
      if (n.disclosed_at && n.disclosed_at > newest) newest = n.disclosed_at;
      const pid = row.programHandle ? handleToId.get(row.programHandle) ?? null : null;
      if (pid) mapped++;
      batch.push(pid ? { ...row, programId: pid } : row);
    }
    if (batch.length > 0) {
      const ins = await db
        .insert(schema.disclosedReports)
        .values(batch)
        .onConflictDoNothing({ target: [schema.disclosedReports.platform, schema.disclosedReports.externalId] })
        .returning({ id: schema.disclosedReports.id });
      inserted += ins.length;
    }
    if (p % 10 === 0) console.error(`page ${p + 1}: ${pages} walked, ${inserted} new, oldest ${oldest}`);
    cursor = endCursor;
    if (!cursor) { console.error('cursor ended'); break; }
  }

  console.log(JSON.stringify({ pages, nodesSeen, built, inserted, withAmount, mapped, oldest, newest, hitCap: pages >= maxPages }, null, 2));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
