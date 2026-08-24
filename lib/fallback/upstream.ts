// Read-only fallback used when the DB is unavailable (Neon monthly quota, etc).
// Reconstructs the index in-memory from arkadiyt/bounty-targets-data — the same upstream
// the ingest cron mirrors — so /programs, /scope-lookup, and program detail pages keep
// working without a DB. Snapshot-history features (whats-new, feed's firstSeenAt) can't be
// rebuilt without persisted history and surface a scoped banner instead.
import { NORMALIZERS, SOURCES, type NormalizedProgram, type Platform } from '@/lib/ingest/bounty-targets';
import type { Program, Scope } from '@/lib/db/schema';
import type { ProgramFilters } from '@/lib/db/queries';
// ponytail: type-only imports above break the runtime cycle with queries.ts.

// Deterministic 31-bit positive int from `platform:slug`. Same input → same synthetic id
// within a deployment, so URL routes like /programs/hackerone/shopify stay stable.
function synthId(platform: string, slug: string): number {
  let h = 5381;
  const s = `${platform}:${slug}`;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h & 0x7fffffff;
}

interface Store {
  programs: Program[];
  scopesByProgram: Map<number, Scope[]>;
  byPlatformSlug: Map<string, Program>;
}

async function fetchPlatform(platform: Platform): Promise<NormalizedProgram[]> {
  const res = await fetch(SOURCES[platform], { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`${platform}: HTTP ${res.status}`);
  const parsed = await res.json();
  const records: unknown[] = Array.isArray(parsed) ? parsed : (parsed?.programs ?? []);
  const normalize = NORMALIZERS[platform];
  const out: NormalizedProgram[] = [];
  for (const r of records) {
    const n = normalize(r);
    if (n) out.push(n);
  }
  return out;
}

async function buildStore(): Promise<Store> {
  const platforms = Object.keys(SOURCES) as Platform[];
  const settled = await Promise.allSettled(platforms.map((p) => fetchPlatform(p).then((rows) => ({ p, rows }))));

  const programs: Program[] = [];
  const scopesByProgram = new Map<number, Scope[]>();
  const byPlatformSlug = new Map<string, Program>();
  const now = new Date();

  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    const { p, rows } = s.value;
    for (const n of rows) {
      const id = synthId(p, n.slug);
      const programType = n.offersBounty ? 'bounty' : 'vdp';
      const program: Program = {
        id,
        slug: n.slug,
        platform: p,
        name: n.name,
        handle: n.handle,
        url: n.url,
        programType,
        offersBounty: n.offersBounty,
        offersSwag: n.offersSwag,
        managed: n.managed,
        minBounty: n.minBounty,
        maxBounty: n.maxBounty,
        currency: n.currency,
        submissionState: n.submissionState,
        safeHarbor: n.safeHarbor,
        lastUpdatedAt: now,
        firstSeenAt: now,
        raw: n.raw,
        searchText: [n.name, n.handle, n.slug].filter(Boolean).join(' ').toLowerCase(),
      };
      programs.push(program);
      byPlatformSlug.set(`${p}:${n.slug}`, program);
      let sid = 1;
      const scopes: Scope[] = n.scopes.map((sc) => ({
        id: id * 1000 + sid++,
        programId: id,
        identifier: sc.identifier,
        assetType: sc.assetType,
        inScope: sc.inScope,
        eligibleForBounty: sc.eligibleForBounty,
        severity: sc.severity,
        instruction: sc.instruction,
      }));
      scopesByProgram.set(id, scopes);
    }
  }

  return { programs, scopesByProgram, byPlatformSlug };
}

// Module-level cache. Next's fetch cache handles per-URL revalidation; this memoizes the
// normalized build across calls within the same instance. On a serverless invocation the
// promise resolves once, and every reader within the request awaits the same result.
let cache: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!cache) {
    cache = buildStore().catch((err) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}

// --- Read implementations mirroring lib/db/queries.ts ---

export async function listProgramsFallback(f: ProgramFilters = {}) {
  const store = await getStore();
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(5000, Math.max(1, f.pageSize ?? 25));
  const q = f.q?.trim().toLowerCase();

  let rows = store.programs.slice();

  if (q) {
    rows = rows.filter((p) => {
      if ((p.searchText ?? '').includes(q)) return true;
      const scopes = store.scopesByProgram.get(p.id) ?? [];
      return scopes.some((s) => s.inScope && s.identifier.toLowerCase().includes(q));
    });
  }
  if (f.platform?.length) {
    const set = new Set(f.platform);
    rows = rows.filter((p) => set.has(p.platform));
  }
  if (f.programType && f.programType !== 'all') {
    rows = rows.filter((p) => p.programType === f.programType);
  }
  if (f.hasBounty) rows = rows.filter((p) => p.offersBounty);
  if (f.minReward) rows = rows.filter((p) => (p.maxBounty ?? 0) >= f.minReward!);
  if (f.safeHarbor) rows = rows.filter((p) => p.safeHarbor && p.safeHarbor !== 'none');
  if (f.assetType?.length) {
    const set = new Set(f.assetType);
    rows = rows.filter((p) => (store.scopesByProgram.get(p.id) ?? []).some((s) => s.inScope && set.has(s.assetType)));
  }

  // ponytail: name-sort is the closest thing to a stable "newest" without firstSeenAt.
  // Real newness returns when the DB is back.
  if (f.sort === 'reward') {
    rows.sort((a, b) => (b.maxBounty ?? -1) - (a.maxBounty ?? -1));
  } else if (f.sort === 'name') {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  const total = rows.length;
  const offset = (page - 1) * pageSize;
  return { rows: rows.slice(offset, offset + pageSize), total, page, pageSize };
}

export async function getProgramBySlugFallback(platform: string, slug: string) {
  const store = await getStore();
  const program = store.byPlatformSlug.get(`${platform}:${slug}`);
  if (!program) return null;
  return { program, scopes: store.scopesByProgram.get(program.id) ?? [] };
}

export async function findByDomainFallback(domain: string) {
  const d = domain.toLowerCase().trim();
  if (!d) return [];
  const store = await getStore();
  const out: Array<{ program: Program; scope: Scope }> = [];
  for (const program of store.programs) {
    const scopes = store.scopesByProgram.get(program.id) ?? [];
    for (const scope of scopes) {
      const id = scope.identifier.toLowerCase();
      if (id.includes(d) || id.includes(`*.${d}`)) {
        out.push({ program, scope });
        if (out.length >= 400) return out;
      }
    }
  }
  return out;
}

export async function statsFallback() {
  const store = await getStore();
  const programs = store.programs.length;
  let bountyPrograms = 0;
  let inScopeAssets = 0;
  const platformSet = new Set<string>();
  for (const p of store.programs) {
    if (p.offersBounty) bountyPrograms++;
    platformSet.add(p.platform);
    for (const s of store.scopesByProgram.get(p.id) ?? []) if (s.inScope) inScopeAssets++;
  }
  return { programs, bountyPrograms, inScopeAssets, platforms: platformSet.size, lastIngestAt: null };
}

export async function topPayoutsFallback(limit = 5) {
  const store = await getStore();
  return store.programs
    .filter((p) => p.offersBounty && p.maxBounty != null)
    .sort((a, b) => (b.maxBounty ?? 0) - (a.maxBounty ?? 0))
    .slice(0, limit);
}

export async function getProgramsByIdsFallback(ids: number[]) {
  if (!ids.length) return [];
  const store = await getStore();
  const byId = new Map(store.programs.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is Program => !!r)
    .map((r) => {
      const scopes = store.scopesByProgram.get(r.id) ?? [];
      const inScope = scopes.filter((s) => s.inScope).length;
      return { ...r, scopeTotal: scopes.length, scopeInScope: inScope };
    });
}
