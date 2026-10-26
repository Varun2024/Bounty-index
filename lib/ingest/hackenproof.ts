import { db, schema } from '@/lib/db/client';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { upsertScopes } from './upsert-scopes';

// HackenProof ingest — two-stage scrape of the Nuxt 3 `__NUXT_DATA__` payload.
//
// HackenProof was dropped from arkadiyt/bounty-targets-data, so this is a first-party scrape
// (same posture as immunefi.ts). Their pages embed a `<script id="__NUXT_DATA__">` holding a
// devalue-serialised array: every field is an INDEX into the flat array, so we parse the array
// once and dereference pointers. Fragile if their serialisation shape changes; snapshotting
// deduplicates unchanged runs so a bad parse is a no-op or one bad program, not a wipe.
//
// Stage 1: /programs?page=N → program list (slug, name, max reward, tags, description).
// Stage 2: /programs/{slug} → the `scopes` array (each = an in/out-of-scope target).

export const HACKENPROOF_LIST_URL = 'https://hackenproof.com/programs';
const PLATFORM = 'hackenproof';
const UA = 'bounty.index-ingest/1.0';
const DETAIL_BATCH_SIZE = 6;
const MAX_PAGES = 40; // ~20 real pages today; cap guards against a pagination bug looping forever.
// ponytail: bound each run. ~400 programs × a detail fetch each would blow Vercel's 300s cap on a
// cold run (and ingestAll runs every platform in series). Cap Stage-2 work per run; unprocessed
// changed programs keep their old stage1Hash and get picked up on the next cron tick.
const MAX_DETAIL_FETCHES_PER_RUN = 120;

interface HackenproofProgram {
  slug: string;
  name: string;
  maxBounty: number | null;
  description: string | null;
  projectTypes: string[];
  assetTypes: string[];
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

// ---- devalue deref ----------------------------------------------------------

type NuxtArray = unknown[];

export function parseNuxtData(html: string): NuxtArray | null {
  const m = html.match(/id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Resolve a devalue pointer. Numbers index into `arr`; -1 means "undefined". Objects/arrays are
// walked so nested pointers resolve too. `seen` guards the cyclic references Nuxt emits for the
// reactive root (e.g. shared stats objects referenced from every program).
function makeDeref(arr: NuxtArray) {
  function deref(node: unknown, seen: ReadonlySet<number> = new Set()): unknown {
    if (typeof node === 'number') {
      if (node < 0 || node >= arr.length || seen.has(node)) return null;
      return deref(arr[node], new Set(seen).add(node));
    }
    if (Array.isArray(node)) return node.map((x) => deref(x, seen));
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) out[k] = deref(v, seen);
      return out;
    }
    return node;
  }
  return deref;
}

function parseReward(raw: unknown): number | null {
  if (typeof raw === 'number') return raw > 0 ? raw : null;
  if (typeof raw !== 'string') return null;
  const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function parseHackenproofList(html: string): HackenproofProgram[] {
  const arr = parseNuxtData(html);
  if (!arr) return [];
  const deref = makeDeref(arr);
  const seen = new Map<string, HackenproofProgram>();
  for (const node of arr) {
    // A program template is a plain object carrying slug + name + reward pointers.
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    const keys = node as Record<string, unknown>;
    if (!('slug' in keys) || !('name' in keys) || !('reward' in keys)) continue;
    const p = deref(node) as Record<string, unknown>;
    const slug = typeof p.slug === 'string' ? p.slug : null;
    const name = typeof p.name === 'string' ? p.name : null;
    if (!slug || !name || seen.has(slug)) continue;
    const tags = (p.tags && typeof p.tags === 'object' ? p.tags : {}) as Record<string, unknown>;
    seen.set(slug, {
      slug,
      name,
      maxBounty: parseReward(p.reward),
      description: typeof p.description === 'string' ? p.description : null,
      projectTypes: asStringArray(tags.project_types),
      assetTypes: asStringArray(tags.types),
    });
  }
  return [...seen.values()];
}

// HackenProof scope "title" / asset category → our scope asset_type enum.
function detectAssetType(title: string | null, target: string): string {
  const t = `${title ?? ''} ${target}`.toLowerCase();
  if (t.includes('android') || t.includes('apk') || t.includes('google play')) return 'android';
  if (t.includes('ios') || t.includes('apple') || t.includes('testflight')) return 'ios';
  if (t.includes('api') || t.includes('websocket')) return 'api';
  if (t.includes('smart') || t.includes('contract') || t.includes('blockchain')) return 'smart_contract';
  if (t.includes('source') || t.includes('repo') || t.includes('code')) return 'source_code';
  if (target.startsWith('*.')) return 'wildcard';
  if (t.includes('web') || target.startsWith('http') || target.includes('.')) return 'url';
  return 'other';
}

export function parseHackenproofScopes(html: string): NormalizedScope[] {
  const arr = parseNuxtData(html);
  if (!arr) return [];
  const deref = makeDeref(arr);
  // The detail page has exactly one program object carrying a `scopes` array.
  let scopesNode: unknown = null;
  for (const node of arr) {
    if (node && typeof node === 'object' && !Array.isArray(node) && 'scopes' in (node as object)) {
      scopesNode = (deref(node) as Record<string, unknown>).scopes;
      break;
    }
  }
  if (!Array.isArray(scopesNode)) return [];
  const out: NormalizedScope[] = [];
  for (const raw of scopesNode) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;
    const target = typeof s.target === 'string' ? s.target.trim() : '';
    if (!target) continue;
    const title = typeof s.title === 'string' ? s.title : null;
    const outOfScope = s.out_of_scope === true;
    out.push({
      identifier: target,
      assetType: detectAssetType(title, target),
      inScope: !outOfScope,
      eligibleForBounty: !outOfScope,
      severity: typeof s.criticality === 'string' ? s.criticality : null,
      instruction: typeof s.target_description === 'string' && s.target_description !== target ? s.target_description : null,
    });
  }
  return out;
}

// ---- fetch helpers ----------------------------------------------------------

async function fetchListPage(page: number): Promise<HackenproofProgram[]> {
  const url = page === 1 ? HACKENPROOF_LIST_URL : `${HACKENPROOF_LIST_URL}?page=${page}`;
  const res = await fetch(url, { cache: 'no-store', headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`list page ${page}: HTTP ${res.status}`);
  return parseHackenproofList(await res.text());
}

async function fetchDetailScopes(slug: string): Promise<NormalizedScope[]> {
  const url = `${HACKENPROOF_LIST_URL}/${encodeURIComponent(slug)}`;
  const res = await fetch(url, { cache: 'no-store', headers: { 'user-agent': UA } });
  if (!res.ok) return [];
  return parseHackenproofScopes(await res.text());
}

function programUrl(slug: string): string {
  return `${HACKENPROOF_LIST_URL}/${slug}`;
}

function buildSnapshotPayload(p: HackenproofProgram, scopes: NormalizedScope[]): SnapshotPayload {
  const inScope = scopes.filter((s) => s.inScope);
  return {
    name: p.name,
    url: programUrl(p.slug),
    handle: p.slug,
    programType: p.maxBounty ? 'bounty' : 'vdp',
    offersBounty: p.maxBounty !== null,
    offersSwag: false,
    managed: true, // HackenProof programs are triaged on-platform
    minBounty: null,
    maxBounty: p.maxBounty,
    currency: 'USD',
    submissionState: null,
    safeHarbor: null, // not exposed structurally
    scopeCount: scopes.length,
    inScopeCount: inScope.length,
    scopeIdentifiers: inScope.map((s) => s.identifier).sort(),
  };
}

function hashPayload(p: SnapshotPayload): string {
  return createHash('sha256').update(JSON.stringify(p)).digest('hex');
}

// Hash of Stage-1 fields. Unchanged since last run → skip Stage-2 fetch AND persist.
function hashStage1(p: HackenproofProgram): string {
  const canonical = JSON.stringify([p.slug, p.name, p.maxBounty, p.description, p.projectTypes, p.assetTypes]);
  return createHash('sha256').update(canonical).digest('hex');
}

async function upsertSource(): Promise<number> {
  const [row] = await db
    .insert(schema.sources)
    .values({ name: PLATFORM, url: HACKENPROOF_LIST_URL })
    .onConflictDoUpdate({ target: schema.sources.name, set: { url: HACKENPROOF_LIST_URL } })
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
  programsDeferred: number;
}

export async function ingestHackenproof(): Promise<Result> {
  const sourceId = await upsertSource();
  const [run] = await db.insert(schema.ingestRuns).values({ sourceId }).returning({ id: schema.ingestRuns.id });
  let programsUpserted = 0;
  let scopesUpserted = 0;
  let snapshotsWritten = 0;
  let detailFetchFailures = 0;
  let programsSkipped = 0;
  let programsDeferred = 0;

  try {
    // Stage 1: paginate the program list until a page returns nothing.
    const programs: HackenproofProgram[] = [];
    const seenSlugs = new Set<string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchListPage(page);
      if (batch.length === 0) break;
      let added = 0;
      for (const p of batch) {
        if (seenSlugs.has(p.slug)) continue;
        seenSlugs.add(p.slug);
        programs.push(p);
        added++;
      }
      if (added === 0) break; // same programs repeating = past the last real page
    }
    if (programs.length === 0) throw new Error('parse returned 0 programs (NUXT_DATA shape may have changed)');

    // Load stored Stage-1 hashes so unchanged programs skip Stage-2 entirely.
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

    const stage1HashByProgram = new Map<HackenproofProgram, string>();
    const changed: HackenproofProgram[] = [];
    for (const p of programs) {
      const h = hashStage1(p);
      stage1HashByProgram.set(p, h);
      if (priorHashBySlug.get(p.slug) === h) programsSkipped++;
      else changed.push(p);
    }

    // Bound Stage-2 work per run. Deferred programs keep their old hash and return next tick.
    const toProcess = changed.slice(0, MAX_DETAIL_FETCHES_PER_RUN);
    programsDeferred = changed.length - toProcess.length;

    // Stage 2: fetch detail pages in small polite batches.
    const scopesBySlug = new Map<string, NormalizedScope[]>();
    for (let i = 0; i < toProcess.length; i += DETAIL_BATCH_SIZE) {
      const batch = toProcess.slice(i, i + DETAIL_BATCH_SIZE);
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
        if (r.scopes === null) detailFetchFailures++;
        else scopesBySlug.set(r.slug, r.scopes);
      }
    }

    // Persist processed programs + scopes + snapshots.
    for (const p of toProcess) {
      const url = programUrl(p.slug);
      const scopes = scopesBySlug.get(p.slug) ?? [];
      const programType = p.maxBounty ? 'bounty' : 'vdp';
      const raw: Record<string, unknown> = {
        description: p.description,
        projectTypes: p.projectTypes,
        assetTypes: p.assetTypes,
        stage1Hash: stage1HashByProgram.get(p),
      };

      const [prog] = await db
        .insert(schema.programs)
        .values({
          slug: p.slug,
          platform: PLATFORM,
          name: p.name,
          handle: p.slug,
          url,
          programType,
          offersBounty: p.maxBounty !== null,
          offersSwag: false,
          managed: true,
          minBounty: null,
          maxBounty: p.maxBounty,
          currency: 'USD',
          submissionState: null,
          safeHarbor: null,
          lastUpdatedAt: new Date(),
          raw,
          searchText: [p.name, p.slug, ...p.projectTypes].join(' '),
        })
        .onConflictDoUpdate({
          target: [schema.programs.platform, schema.programs.slug],
          set: {
            name: p.name,
            url,
            handle: p.slug,
            programType,
            offersBounty: p.maxBounty !== null,
            maxBounty: p.maxBounty,
            lastUpdatedAt: new Date(),
            raw,
          },
        })
        .returning({ id: schema.programs.id });
      programsUpserted++;

      scopesUpserted += await upsertScopes(prog.id, scopes);

      const wrote = await maybeSnapshot(prog.id, run.id, buildSnapshotPayload(p, scopes));
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
    return { platform: PLATFORM, programsUpserted, scopesUpserted, snapshotsWritten, detailFetchFailures, programsSkipped, programsDeferred };
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
