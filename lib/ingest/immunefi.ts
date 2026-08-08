import { db, schema } from '@/lib/db/client';
import { eq, desc } from 'drizzle-orm';
import { createHash } from 'node:crypto';

// Immunefi doesn't ship in arkadiyt/bounty-targets-data. They have a first-party API for
// individual assets (`/public-api/bounties/assets/dice`) but it only surfaces ~6 rows at a
// time. The full program list lives inside the RSC payload of their /bug-bounty/ landing
// page — one <script> that pushes escaped JSON. We fetch the HTML once and grep it.
//
// ponytail: HTML scrape, not an API. Fragile if they change their RSC shape. Snapshotting
// deduplicates unchanged runs anyway, so a bad parse just produces a no-op.

const LIST_URL = 'https://immunefi.com/bug-bounty/';
const PLATFORM = 'immunefi';

interface ImmunefiProgram {
  slug: string;
  project: string;
  maxBounty: number;
  logo: string | null;
  launchDate: string | null;
  safeHarbor: 'full' | null;
  kyc: boolean;
  managed: boolean;
}

interface SnapshotPayload {
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

function parseImmunefiHtml(html: string): ImmunefiProgram[] {
  // For each occurrence of `maxBounty":N` in the RSC payload, grab a window and pull the
  // sibling fields. Order of keys varies so we can't do a single positional regex.
  const seen = new Map<string, ImmunefiProgram>();
  let i = html.indexOf('maxBounty');
  while (i !== -1) {
    const win = html.slice(Math.max(0, i - 800), i + 1200);
    const mb = win.match(/maxBounty\\":(\d+)/);
    const sl = win.match(/slug\\":\\"([a-z0-9-]+)\\"/);
    const pj = win.match(/project\\":\\"([^"\\]+)\\"/);
    const lo = win.match(/logo\\":\\"([^"\\]+)\\"/);
    const ld = win.match(/launchDate\\":\\"([^"\\]+)\\"/);
    const sh = win.match(/isSafeHarborActive\\":(true|false)/);
    const kyc = win.match(/(?:^|[,{])kyc\\":(true|false)/);
    const managed = win.match(/premiumTriaging\\":(true|false)/);
    if (sl && pj && mb && !seen.has(sl[1])) {
      seen.set(sl[1], {
        slug: sl[1],
        project: pj[1],
        maxBounty: parseInt(mb[1], 10),
        logo: lo?.[1] ?? null,
        launchDate: ld?.[1] ?? null,
        safeHarbor: sh?.[1] === 'true' ? 'full' : null,
        kyc: kyc?.[1] === 'true',
        managed: managed?.[1] === 'true',
      });
    }
    i = html.indexOf('maxBounty', i + 1);
  }
  return [...seen.values()];
}

function buildSnapshotPayload(p: ImmunefiProgram, url: string): SnapshotPayload {
  return {
    name: p.project,
    url,
    handle: p.slug,
    programType: 'bounty',
    offersBounty: true,
    offersSwag: false,
    managed: p.managed,
    minBounty: null,
    maxBounty: p.maxBounty > 0 ? p.maxBounty : null,
    currency: 'USD',
    submissionState: null,
    safeHarbor: p.safeHarbor,
    scopeCount: 0,
    inScopeCount: 0,
    scopeIdentifiers: [],
  };
}

function hashPayload(p: SnapshotPayload): string {
  return createHash('sha256').update(JSON.stringify(p)).digest('hex');
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
  const hash = hashPayload(payload);
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

export async function ingestImmunefi(): Promise<{ platform: string; programsUpserted: number; snapshotsWritten: number; error?: string }> {
  const sourceId = await upsertSource();
  const [run] = await db.insert(schema.ingestRuns).values({ sourceId }).returning({ id: schema.ingestRuns.id });
  let programsUpserted = 0;
  let snapshotsWritten = 0;
  try {
    const res = await fetch(LIST_URL, { cache: 'no-store', headers: { 'user-agent': 'bounty.index-ingest/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const programs = parseImmunefiHtml(html);
    if (programs.length === 0) throw new Error('parse returned 0 programs (RSC shape may have changed)');

    for (const p of programs) {
      const url = `https://immunefi.com/bug-bounty/${p.slug}/information/`;
      const searchText = [p.project, p.slug].join(' ');
      const raw: Record<string, unknown> = {
        logo: p.logo,
        launchDate: p.launchDate,
        kyc: p.kyc,
      };
      const [prog] = await db
        .insert(schema.programs)
        .values({
          slug: p.slug,
          platform: PLATFORM,
          name: p.project,
          handle: p.slug,
          url,
          programType: 'bounty',
          offersBounty: true,
          offersSwag: false,
          managed: p.managed,
          minBounty: null,
          maxBounty: p.maxBounty > 0 ? p.maxBounty : null,
          currency: 'USD',
          submissionState: null,
          safeHarbor: p.safeHarbor,
          lastUpdatedAt: new Date(),
          raw,
          searchText,
        })
        .onConflictDoUpdate({
          target: [schema.programs.platform, schema.programs.slug],
          set: {
            name: p.project,
            url,
            handle: p.slug,
            programType: 'bounty',
            offersBounty: true,
            managed: p.managed,
            maxBounty: p.maxBounty > 0 ? p.maxBounty : null,
            safeHarbor: p.safeHarbor,
            lastUpdatedAt: new Date(),
            raw,
          },
        })
        .returning({ id: schema.programs.id });
      programsUpserted++;

      const wrote = await maybeSnapshot(prog.id, run.id, buildSnapshotPayload(p, url));
      if (wrote) snapshotsWritten++;
    }

    await db
      .update(schema.ingestRuns)
      .set({ status: 'ok', finishedAt: new Date(), programsUpserted, scopesUpserted: 0 })
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
