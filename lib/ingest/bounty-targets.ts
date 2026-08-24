import { db, schema } from '@/lib/db/client';
import { eq, desc } from 'drizzle-orm';
import { createHash } from 'node:crypto';

const BASE = 'https://raw.githubusercontent.com/arkadiyt/bounty-targets-data/main/data';

// ponytail: hackenproof file was removed upstream. Re-add if arkadiyt/bounty-targets-data brings it back.
export type Platform = 'hackerone' | 'bugcrowd' | 'intigriti' | 'yeswehack' | 'federacy';

export const SOURCES: Record<Platform, string> = {
  hackerone: `${BASE}/hackerone_data.json`,
  bugcrowd: `${BASE}/bugcrowd_data.json`,
  intigriti: `${BASE}/intigriti_data.json`,
  yeswehack: `${BASE}/yeswehack_data.json`,
  federacy: `${BASE}/federacy_data.json`,
};

export interface NormalizedProgram {
  slug: string;
  handle: string | null;
  name: string;
  url: string;
  offersBounty: boolean;
  offersSwag: boolean;
  managed: boolean;
  minBounty: number | null;
  maxBounty: number | null;
  currency: string;
  submissionState: string | null;
  safeHarbor: string | null;
  scopes: NormalizedScope[];
  raw: object;
}

export interface NormalizedScope {
  identifier: string;
  assetType: string;
  inScope: boolean;
  eligibleForBounty: boolean;
  severity: string | null;
  instruction: string | null;
}

interface TargetItem {
  target?: string;
  identifier?: string;
  asset_identifier?: string;
  endpoint?: string; // intigriti
  asset_type?: string;
  type?: string;
  category?: string;
  impact?: string; // intigriti severity/tier
  eligible_for_bounty?: boolean;
  eligible_for_submission?: boolean;
  instruction?: string | null;
  description?: string | null;
  max_severity?: string | null;
}

interface RawTargets {
  in_scope?: TargetItem[];
  out_of_scope?: TargetItem[];
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function detectAssetType(raw: string | undefined | null): string {
  const t = (raw ?? '').toLowerCase();
  if (!t) return 'other';
  if (t.includes('android') || t.includes('google play') || t.includes('apk')) return 'android';
  if (t.includes('ios') || t.includes('apple') || t.includes('testflight')) return 'ios';
  if (t.includes('api')) return 'api';
  if (t.includes('source') || t.includes('code')) return 'source_code';
  if (t.includes('hardware') || t.includes('iot') || t.includes('device')) return 'hardware';
  if (t.includes('smart') || t.includes('contract') || t.includes('blockchain')) return 'smart_contract';
  if (t.includes('wildcard')) return 'wildcard';
  if (t.includes('executable')) return 'other';
  if (t.includes('url') || t.includes('web') || t.includes('domain') || t.includes('site')) return 'url';
  return 'other';
}

function identifierOf(s: TargetItem): string | null {
  const id = s.identifier ?? s.target ?? s.asset_identifier ?? s.endpoint ?? null;
  if (!id) return null;
  return String(id);
}

function normalizeScopes(t: RawTargets, offersBounty: boolean): NormalizedScope[] {
  const out: NormalizedScope[] = [];
  for (const s of t.in_scope ?? []) {
    const identifier = identifierOf(s);
    if (!identifier) continue;
    let assetType = detectAssetType(s.asset_type ?? s.type ?? s.category);
    if (assetType === 'url' && identifier.startsWith('*.')) assetType = 'wildcard';
    out.push({
      identifier,
      assetType,
      inScope: true,
      eligibleForBounty: s.eligible_for_bounty ?? offersBounty,
      severity: s.max_severity ?? s.impact ?? null,
      instruction: s.instruction ?? s.description ?? null,
    });
  }
  for (const s of t.out_of_scope ?? []) {
    const identifier = identifierOf(s);
    if (!identifier) continue;
    out.push({
      identifier,
      assetType: detectAssetType(s.asset_type ?? s.type ?? s.category),
      inScope: false,
      eligibleForBounty: false,
      severity: null,
      instruction: null,
    });
  }
  return out;
}

// ---- Per-platform normalizers ----

interface HackerOneRecord {
  handle?: string;
  name?: string;
  url?: string;
  offers_bounties?: boolean;
  offers_swag?: boolean;
  managed_program?: boolean;
  submission_state?: string;
  targets?: RawTargets;
}

function normalizeHackerOne(r: HackerOneRecord): NormalizedProgram | null {
  if (!r.name || !r.handle) return null;
  const offersBounty = !!r.offers_bounties;
  return {
    slug: r.handle,
    handle: r.handle,
    name: r.name,
    url: r.url ?? `https://hackerone.com/${r.handle}`,
    offersBounty,
    offersSwag: !!r.offers_swag,
    managed: !!r.managed_program,
    minBounty: null, // HackerOne data doesn't expose exact $ at program level
    maxBounty: null,
    currency: 'USD',
    submissionState: r.submission_state ?? null,
    safeHarbor: null, // HackerOne data doesn't expose this structurally
    scopes: normalizeScopes(r.targets ?? {}, offersBounty),
    raw: r as unknown as object,
  };
}

interface BugcrowdRecord {
  name?: string;
  url?: string;
  max_payout?: number | null;
  managed_by_bugcrowd?: boolean;
  safe_harbor?: string;
  allows_disclosure?: boolean;
  targets?: RawTargets;
}

function normalizeBugcrowd(r: BugcrowdRecord): NormalizedProgram | null {
  if (!r.name) return null;
  const slug = r.url ? r.url.replace(/^.*bugcrowd\.com\//, '').replace(/\/$/, '') : slugify(r.name);
  const offersBounty = (r.max_payout ?? 0) > 0;
  const safeHarborRaw = (r.safe_harbor ?? '').toLowerCase().trim();
  // Bugcrowd values seen: "full", "partial", "none", "". Normalize; leave unknown as null.
  const safeHarbor = safeHarborRaw === 'full' || safeHarborRaw === 'partial' || safeHarborRaw === 'none' ? safeHarborRaw : null;
  return {
    slug,
    handle: slug,
    name: r.name,
    url: r.url ?? `https://bugcrowd.com/${slug}`,
    offersBounty,
    offersSwag: false,
    managed: !!r.managed_by_bugcrowd,
    minBounty: null,
    maxBounty: r.max_payout ?? null,
    currency: 'USD',
    submissionState: null,
    safeHarbor,
    scopes: normalizeScopes(r.targets ?? {}, offersBounty),
    raw: r as unknown as object,
  };
}

interface IntigritiBountyField { value?: number; currency?: string }
interface IntigritiRecord {
  id?: string | number;
  handle?: string;
  company_handle?: string;
  name?: string;
  url?: string;
  status?: string;
  min_bounty?: IntigritiBountyField | null;
  max_bounty?: IntigritiBountyField | null;
  targets?: RawTargets;
}

function normalizeIntigriti(r: IntigritiRecord): NormalizedProgram | null {
  if (!r.name) return null;
  const slug = r.handle ?? (r.company_handle ? `${r.company_handle}-${slugify(r.name)}` : slugify(r.name));
  const min = r.min_bounty?.value ?? null;
  const max = r.max_bounty?.value ?? null;
  const currency = r.max_bounty?.currency ?? r.min_bounty?.currency ?? 'EUR';
  const offersBounty = (max ?? 0) > 0;
  return {
    slug,
    handle: r.handle ?? null,
    name: r.name,
    url: r.url ?? `https://app.intigriti.com/programs/${slug}`,
    offersBounty,
    offersSwag: false,
    managed: false,
    minBounty: min,
    maxBounty: max,
    currency,
    submissionState: r.status ?? null,
    safeHarbor: null,
    scopes: normalizeScopes(r.targets ?? {}, offersBounty),
    raw: r as unknown as object,
  };
}

interface YesWeHackRecord {
  id?: string | number;
  name?: string;
  public?: boolean;
  disabled?: boolean;
  managed?: boolean;
  min_bounty?: number | null;
  max_bounty?: number | null;
  targets?: RawTargets;
  url?: string;
  slug?: string;
}

function normalizeYesWeHack(r: YesWeHackRecord): NormalizedProgram | null {
  if (!r.name) return null;
  const slug = r.slug ?? slugify(r.name);
  const offersBounty = (r.max_bounty ?? 0) > 0;
  return {
    slug,
    handle: null,
    name: r.name,
    url: r.url ?? `https://yeswehack.com/programs/${slug}`,
    offersBounty,
    offersSwag: false,
    managed: !!r.managed,
    minBounty: r.min_bounty ?? null,
    maxBounty: r.max_bounty ?? null,
    currency: 'EUR',
    submissionState: r.disabled ? 'closed' : 'open',
    safeHarbor: null,
    scopes: normalizeScopes(r.targets ?? {}, offersBounty),
    raw: r as unknown as object,
  };
}

interface FederacyRecord {
  id?: string | number;
  name?: string;
  offers_awards?: boolean;
  url?: string;
  targets?: RawTargets;
}

function normalizeFederacy(r: FederacyRecord): NormalizedProgram | null {
  if (!r.name) return null;
  const slug = r.url ? r.url.replace(/^.*federacy\.com\//, '').replace(/\/$/, '').replace(/^programs\//, '') : slugify(r.name);
  return {
    slug: slug || slugify(r.name),
    handle: null,
    name: r.name,
    url: r.url ?? `https://www.federacy.com/${slug}`,
    offersBounty: false,
    offersSwag: !!r.offers_awards,
    managed: false,
    minBounty: null,
    maxBounty: null,
    currency: 'USD',
    submissionState: null,
    safeHarbor: null,
    scopes: normalizeScopes(r.targets ?? {}, false),
    raw: r as unknown as object,
  };
}

export const NORMALIZERS: Record<Platform, (r: unknown) => NormalizedProgram | null> = {
  hackerone: (r) => normalizeHackerOne(r as HackerOneRecord),
  bugcrowd: (r) => normalizeBugcrowd(r as BugcrowdRecord),
  intigriti: (r) => normalizeIntigriti(r as IntigritiRecord),
  yeswehack: (r) => normalizeYesWeHack(r as YesWeHackRecord),
  federacy: (r) => normalizeFederacy(r as FederacyRecord),
};

// ---- Fetch + persist ----

async function fetchSource(platform: Platform): Promise<unknown[]> {
  const res = await fetch(SOURCES[platform], { cache: 'no-store' });
  if (!res.ok) throw new Error(`${platform}: HTTP ${res.status}`);
  const text = await res.text();
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : (parsed?.programs ?? []);
}

async function upsertSource(platform: Platform): Promise<number> {
  const [row] = await db
    .insert(schema.sources)
    .values({ name: platform, url: SOURCES[platform] })
    .onConflictDoUpdate({ target: schema.sources.name, set: { url: SOURCES[platform] } })
    .returning({ id: schema.sources.id });
  return row.id;
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
  scopeIdentifiers: string[]; // sorted list of in-scope identifiers
}

function buildSnapshotPayload(norm: NormalizedProgram, programType: string): SnapshotPayload {
  const inScope = norm.scopes.filter((s) => s.inScope);
  return {
    name: norm.name,
    url: norm.url,
    handle: norm.handle,
    programType,
    offersBounty: norm.offersBounty,
    offersSwag: norm.offersSwag,
    managed: norm.managed,
    minBounty: norm.minBounty,
    maxBounty: norm.maxBounty,
    currency: norm.currency,
    submissionState: norm.submissionState,
    safeHarbor: norm.safeHarbor,
    scopeCount: norm.scopes.length,
    inScopeCount: inScope.length,
    scopeIdentifiers: inScope.map((s) => s.identifier).sort(),
  };
}

function hashPayload(p: SnapshotPayload): string {
  // Deterministic: keys are declared in-order above; scopeIdentifiers already sorted.
  return createHash('sha256').update(JSON.stringify(p)).digest('hex');
}

async function maybeSnapshot(programId: number, ingestRunId: number, payload: SnapshotPayload) {
  const hash = hashPayload(payload);
  const [latest] = await db
    .select({ contentHash: schema.programSnapshots.contentHash })
    .from(schema.programSnapshots)
    .where(eq(schema.programSnapshots.programId, programId))
    .orderBy(desc(schema.programSnapshots.capturedAt))
    .limit(1);
  if (latest && latest.contentHash === hash) return false;
  await db.insert(schema.programSnapshots).values({
    programId,
    ingestRunId,
    contentHash: hash,
    payload,
  });
  return true;
}

export async function ingestPlatform(platform: Platform) {
  const sourceId = await upsertSource(platform);
  const [run] = await db.insert(schema.ingestRuns).values({ sourceId }).returning({ id: schema.ingestRuns.id });
  let programsUpserted = 0;
  let scopesUpserted = 0;
  let snapshotsWritten = 0;
  try {
    const records = await fetchSource(platform);
    const normalize = NORMALIZERS[platform];
    for (const rec of records) {
      const norm = normalize(rec);
      if (!norm) continue;

      const programType = norm.offersBounty ? 'bounty' : 'vdp';
      const [prog] = await db
        .insert(schema.programs)
        .values({
          slug: norm.slug,
          platform,
          name: norm.name,
          handle: norm.handle,
          url: norm.url,
          programType,
          offersBounty: norm.offersBounty,
          offersSwag: norm.offersSwag,
          managed: norm.managed,
          minBounty: norm.minBounty,
          maxBounty: norm.maxBounty,
          currency: norm.currency,
          submissionState: norm.submissionState,
          safeHarbor: norm.safeHarbor,
          lastUpdatedAt: new Date(),
          raw: norm.raw,
          searchText: [norm.name, norm.handle, norm.slug].filter(Boolean).join(' '),
        })
        .onConflictDoUpdate({
          target: [schema.programs.platform, schema.programs.slug],
          set: {
            name: norm.name,
            url: norm.url,
            handle: norm.handle,
            programType,
            offersBounty: norm.offersBounty,
            offersSwag: norm.offersSwag,
            managed: norm.managed,
            minBounty: norm.minBounty,
            maxBounty: norm.maxBounty,
            currency: norm.currency,
            submissionState: norm.submissionState,
            safeHarbor: norm.safeHarbor,
            lastUpdatedAt: new Date(),
            raw: norm.raw,
          },
        })
        .returning({ id: schema.programs.id });
      programsUpserted++;

      await db.delete(schema.scopes).where(eq(schema.scopes.programId, prog.id));
      if (norm.scopes.length) {
        const rows = norm.scopes.map((s) => ({ programId: prog.id, ...s }));
        // ponytail: PG bind limit is 65535 params. Scopes have 7 cols → 500 rows/chunk keeps us well under.
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          await db.insert(schema.scopes).values(rows.slice(i, i + CHUNK));
        }
        scopesUpserted += norm.scopes.length;
      }

      const wrote = await maybeSnapshot(prog.id, run.id, buildSnapshotPayload(norm, programType));
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
    return { platform, programsUpserted, scopesUpserted, snapshotsWritten };
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

export async function ingestAll() {
  const platforms = Object.keys(SOURCES) as Platform[];
  const results: Array<Record<string, unknown>> = [];
  for (const p of platforms) {
    try {
      results.push(await ingestPlatform(p));
    } catch (e) {
      results.push({ platform: p, error: e instanceof Error ? e.message : String(e) });
    }
  }
  // Immunefi lives outside arkadiyt/bounty-targets-data — first-party HTML scrape.
  try {
    const { ingestImmunefi } = await import('./immunefi');
    const r = await ingestImmunefi();
    results.push({ ...r });
  } catch (e) {
    results.push({ platform: 'immunefi', error: e instanceof Error ? e.message : String(e) });
  }
  return results;
}
