'use server';

import { findByDomain } from '@/lib/db/queries';

// Compact scope check for the homepage hero's live "is it in scope?" panel.
// Reuses the same findByDomain the /scope/[domain] page uses, then collapses the
// row set to a program-level verdict small enough to render in the hero. The full
// detail view stays at /scope/<domain>.

const MAX_MATCHES = 6;
const DOMAIN_MAX = 253; // RFC 1035 max hostname length

export interface HeroScopeMatch {
  id: number;
  platform: string;
  slug: string;
  name: string;
  maxBounty: number | null;
  currency: string | null;
  inScope: boolean;
  identifier: string; // representative (longest) matched identifier for this program
}

export type HeroScopeResult =
  | {
      ok: true;
      domain: string;
      verdict: 'in' | 'out' | 'none';
      inScopePrograms: number;
      outOfScopePrograms: number;
      matches: HeroScopeMatch[];
    }
  | { ok: false; error: 'empty' | 'too_long' | 'db' };

function cleanDomain(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

function longest(ids: string[]): string {
  return ids.reduce((a, b) => (b.length > a.length ? b : a), ids[0] ?? '');
}

export async function checkScope(raw: string): Promise<HeroScopeResult> {
  const domain = cleanDomain(raw ?? '');
  if (!domain) return { ok: false, error: 'empty' };
  if (domain.length > DOMAIN_MAX) return { ok: false, error: 'too_long' };

  let rows: Awaited<ReturnType<typeof findByDomain>>;
  try {
    rows = await findByDomain(domain);
  } catch {
    return { ok: false, error: 'db' };
  }

  // Collapse to one entry per program; a program is "in scope" if it lists the
  // identifier in-scope anywhere (you can test the in-scope part), otherwise "out".
  const byProgram = new Map<number, { program: (typeof rows)[number]['program']; inIds: string[]; outIds: string[] }>();
  for (const r of rows) {
    let g = byProgram.get(r.program.id);
    if (!g) {
      g = { program: r.program, inIds: [], outIds: [] };
      byProgram.set(r.program.id, g);
    }
    (r.scope.inScope ? g.inIds : g.outIds).push(r.scope.identifier);
  }

  const groups = [...byProgram.values()];
  const inGroups = groups.filter((g) => g.inIds.length > 0);
  const outGroups = groups.filter((g) => g.inIds.length === 0 && g.outIds.length > 0);

  const toMatch = (g: (typeof groups)[number], inScope: boolean): HeroScopeMatch => ({
    id: g.program.id,
    platform: g.program.platform,
    slug: g.program.slug,
    name: g.program.name,
    maxBounty: g.program.maxBounty,
    currency: g.program.currency,
    inScope,
    identifier: longest(inScope ? g.inIds : g.outIds),
  });

  const matches = [
    ...inGroups.map((g) => toMatch(g, true)),
    ...outGroups.map((g) => toMatch(g, false)),
  ].slice(0, MAX_MATCHES);

  const verdict: 'in' | 'out' | 'none' =
    inGroups.length > 0 ? 'in' : outGroups.length > 0 ? 'out' : 'none';

  return {
    ok: true,
    domain,
    verdict,
    inScopePrograms: inGroups.length,
    outOfScopePrograms: outGroups.length,
    matches,
  };
}
