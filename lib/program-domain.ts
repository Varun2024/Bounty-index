// Best-effort company-domain extraction from a program's in-scope identifiers.
// Used to fetch a favicon logo for the program hero.
//
// Strategy:
// 1. Prefer wildcard scopes — `*.tesla.com` → `tesla.com` maps most reliably to the brand.
// 2. Fall back to plain URL/host identifiers, stripping `www.` and any path.
// 3. If nothing usable, return null and let the caller render a monogram fallback.
//
// Ponytail: heuristic, not perfect. Programs like OpenSea Managed Bug Bounty won't have a plain
// wildcard, and Any host verified... scopes are useless here. That's fine — the caller falls back.

interface ScopeItem {
  identifier: string;
  inScope: boolean;
}

const WILDCARD_RE = /^\*\.([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+)$/i;
const URL_RE = /^https?:\/\/([^\/\s]+)/i;
const BARE_HOST_RE = /^([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+)(\/.*)?$/i;

function stripWww(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

// Reduce a program name to a lowercase token for matching against domain roots.
// "Tesla Motors" → "tesla", "OpenSea Managed Bug Bounty Program" → "opensea".
function programToken(name: string): string {
  return name
    .toLowerCase()
    .replace(/®|™|©/g, '')
    .replace(/\s*(managed\s+bug\s+bounty|bug\s+bounty|vulnerability\s+disclosure|program|vdp)\s*.*$/, '')
    .trim()
    .split(/\s+/)[0] // first word usually holds the brand
    .replace(/[^a-z0-9]/g, '');
}

export function extractCompanyDomain(scopes: ScopeItem[], programName?: string): string | null {
  const inScope = scopes.filter((s) => s.inScope);

  // Collect all candidate domains from wildcards, URLs, and bare hosts.
  const candidates: string[] = [];
  for (const s of inScope) {
    const w = s.identifier.match(WILDCARD_RE);
    if (w) { candidates.push(w[1].toLowerCase()); continue; }
    const u = s.identifier.match(URL_RE);
    if (u) { candidates.push(stripWww(u[1])); continue; }
    const b = s.identifier.match(BARE_HOST_RE);
    if (b) { candidates.push(stripWww(b[1])); continue; }
  }
  if (candidates.length === 0) return null;

  const token = programName ? programToken(programName) : '';

  // Rank:
  // 1. Contains the program-name token in its root label (very strong signal — Shopify → *.shopify.com)
  // 2. Fewer dots wins (more root-y — shopify.com beats pci.shopifyinc.com)
  // 3. Shorter overall (mild tie-breaker)
  const scored = candidates.map((d) => {
    const parts = d.split('.');
    const root = parts.length >= 2 ? parts[parts.length - 2] : parts[0]; // e.g. shopify from shopify.com
    const nameMatch = token.length >= 3 && (root === token || root.includes(token) || token.includes(root));
    return { d, nameMatch, dots: parts.length - 1, len: d.length };
  });
  scored.sort((a, b) => {
    if (a.nameMatch !== b.nameMatch) return a.nameMatch ? -1 : 1;
    if (a.dots !== b.dots) return a.dots - b.dots;
    return a.len - b.len;
  });
  return scored[0].d;
}
