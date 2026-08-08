import { db, schema } from '@/lib/db/client';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';

// Immunefi ingest — two-stage HTML scrape of first-party RSC payloads.
//
// Stage 1: fetch /bug-bounty/ once → parse the program list (name, slug, logo, maxBounty,
//          safe-harbor, kyc, premium-triaging).
// Stage 2: for each program, fetch /bug-bounty/{slug}/information/ → extract the assets
//          array (each asset = a smart-contract address or web URL in-scope).
//
// ponytail: HTML scrape, not an API. Fragile if their RSC shape changes. Snapshotting
// deduplicates unchanged runs, so a bad parse just produces a no-op or one bad program.

const LIST_URL = 'https://immunefi.com/bug-bounty/';
const PLATFORM = 'immunefi';
const DETAIL_BATCH_SIZE = 6; // ~181 programs → 30 batches; keeps total under ~30s.
const UA = 'bounty.index-ingest/1.0';

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

interface ImmunefiAsset {
  id?: string;
  url: string;
  type: string;
  description?: string | null;
}

interface NormalizedScope {
  identifier: string;
  assetType: string;
  inScope: boolean;
  eligibleForBounty: boolean;
  severity: string | null;
  instruction: string | null;
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

// Extract the JSON `assets` array from a program's detail page RSC.
// Walks bracket depth to find the array boundary because it contains nested objects
// and escaped strings.
function extractAssetsFromDetail(html: string): ImmunefiAsset[] {
  const key = 'assets\\":[';
  const idx = html.indexOf(key);
  if (idx < 0) return [];
  const arrayStart = idx + 'assets\\":'.length;
  let depth = 1;
  let inStr = false;
  let i = arrayStart + 1; // skip the opening [
  while (i < html.length && depth > 0) {
    const c = html[i];
    if (c === '\\' && html[i + 1] === '"') { i += 2; continue; }
    if (c === '"') inStr = !inStr;
    if (!inStr) {
      if (c === '[') depth++;
      else if (c === ']') depth--;
    }
    i++;
  }
  const raw = html.slice(arrayStart, i);
  const unescaped = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  try {
    const parsed = JSON.parse(unescaped);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Immunefi asset types → our scope schema's asset_type enum.
const TYPE_MAP: Record<string, string> = {
  smart_contract: 'smart_contract',
  websites_and_applications: 'url',
  blockchain_dlt: 'other',
  executables: 'other',
};

function normalizeAsset(a: ImmunefiAsset): NormalizedScope | null {
  if (!a.url) return null;
  const type = TYPE_MAP[a.type] ?? 'other';
  return {
    identifier: a.url,
    assetType: type,
    inScope: true, // Immunefi program pages list only in-scope assets
    eligibleForBounty: true,
    severity: null,
    instruction: a.description ?? null,
  };
}

async function fetchDetailScopes(slug: string): Promise<NormalizedScope[]> {
  const url = `https://immunefi.com/bug-bounty/${encodeURIComponent(slug)}/information/`;
  const res = await fetch(url, { cache: 'no-store', headers: { 'user-agent': UA } });
  if (!res.ok) return [];
  const html = await res.text();
  const assets = extractAssetsFromDetail(html);
  return assets.map(normalizeAsset).filter((s): s is NormalizedScope => s !== null);
}

function buildSnapshotPayload(p: ImmunefiProgram, url: string, scopes: NormalizedScope[]): SnapshotPayload {
  const inScope = scopes.filter((s) => s.inScope);
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
    scopeCount: scopes.length,
    inScopeCount: inScope.length,
    scopeIdentifiers: inScope.map((s) => s.identifier).sort(),
  };
}

function hashPayload(p: SnapshotPayload): string {
  return createHash('sha256').update(JSON.stringify(p)).digest('hex');
}

// Hash of the Stage-1 program-level fields. If unchanged since the last successful ingest,
// we skip the Stage-2 detail fetch AND the persist step — scopes stay as-is.
function hashStage1(p: ImmunefiProgram): string {
  const canonical = JSON.stringify([p.slug, p.project, p.maxBounty, p.safeHarbor, p.kyc, p.managed, p.logo, p.launchDate]);
  return createHash('sha256').update(canonical).digest('hex');
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

interface Result {
  platform: string;
  programsUpserted: number;
  scopesUpserted: number;
  snapshotsWritten: number;
  detailFetchFailures: number;
  programsSkipped: number;
}

export async function ingestImmunefi(): Promise<Result> {
  const sourceId = await upsertSource();
  const [run] = await db.insert(schema.ingestRuns).values({ sourceId }).returning({ id: schema.ingestRuns.id });
  let programsUpserted = 0;
  let scopesUpserted = 0;
  let snapshotsWritten = 0;
  let detailFetchFailures = 0;
  let programsSkipped = 0;

  try {
    // Stage 1: landing page → program list
    const res = await fetch(LIST_URL, { cache: 'no-store', headers: { 'user-agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const programs = parseImmunefiHtml(html);
    if (programs.length === 0) throw new Error('parse returned 0 programs (RSC shape may have changed)');

    // Load stored Stage-1 hashes so we can skip programs whose landing-page fields haven't changed.
    // ponytail: single query for all slugs on this platform. If Immunefi grows past ~10k programs,
    // this fetches too much; switch to per-slug lookup inside the loop.
    const slugs = programs.map((p) => p.slug);
    const existing = await db
      .select({ slug: schema.programs.slug, raw: schema.programs.raw })
      .from(schema.programs)
      .where(and(eq(schema.programs.platform, PLATFORM), inArray(schema.programs.slug, slugs)));
    const priorHashBySlug = new Map<string, string>();
    for (const row of existing) {
      const raw = row.raw as { stage1Hash?: string } | null;
      if (raw?.stage1Hash) priorHashBySlug.set(row.slug, raw.stage1Hash);
    }

    // Split programs into changed vs unchanged. Unchanged skip Stage-2 fetch AND persist entirely.
    const stage1HashByProgram = new Map<ImmunefiProgram, string>();
    const changed: ImmunefiProgram[] = [];
    for (const p of programs) {
      const h = hashStage1(p);
      stage1HashByProgram.set(p, h);
      if (priorHashBySlug.get(p.slug) === h) {
        programsSkipped++;
      } else {
        changed.push(p);
      }
    }

    // Stage 2: fetch detail pages in batches for CHANGED programs only.
    // ponytail: small concurrency to stay polite; total ~30s for ~180 programs on first run.
    const scopesBySlug = new Map<string, NormalizedScope[]>();
    for (let i = 0; i < changed.length; i += DETAIL_BATCH_SIZE) {
      const batch = changed.slice(i, i + DETAIL_BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (p) => {
          try {
            return { slug: p.slug, scopes: await fetchDetailScopes(p.slug) };
          } catch {
            return { slug: p.slug, scopes: null as NormalizedScope[] | null };
          }
        }),
      );
      for (const r of results) {
        if (r.scopes === null) {
          detailFetchFailures++;
          continue;
        }
        scopesBySlug.set(r.slug, r.scopes);
      }
    }

    // Persist programs + scopes + snapshots — CHANGED only.
    for (const p of changed) {
      const url = `https://immunefi.com/bug-bounty/${p.slug}/information/`;
      const scopes = scopesBySlug.get(p.slug) ?? [];
      const raw: Record<string, unknown> = {
        logo: p.logo,
        launchDate: p.launchDate,
        kyc: p.kyc,
        stage1Hash: stage1HashByProgram.get(p),
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
          searchText: [p.project, p.slug].join(' '),
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

      // Replace scopes for this program
      await db.delete(schema.scopes).where(eq(schema.scopes.programId, prog.id));
      if (scopes.length > 0) {
        const rows = scopes.map((s) => ({ programId: prog.id, ...s }));
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          await db.insert(schema.scopes).values(rows.slice(i, i + CHUNK));
        }
        scopesUpserted += scopes.length;
      }

      const wrote = await maybeSnapshot(prog.id, run.id, buildSnapshotPayload(p, url, scopes));
      if (wrote) snapshotsWritten++;
    }

    await db
      .update(schema.ingestRuns)
      .set({ status: 'ok', finishedAt: new Date(), programsUpserted, scopesUpserted })
      .where(eq(schema.ingestRuns.id, run.id));
    await db
      .update(schema.sources)
      .set({ lastRunAt: new Date(), lastStatus: 'ok', lastError: null })
      .where(eq(schema.sources.id, sourceId));
    return { platform: PLATFORM, programsUpserted, scopesUpserted, snapshotsWritten, detailFetchFailures, programsSkipped };
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
