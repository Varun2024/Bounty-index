import type { MetadataRoute } from 'next';
import { and, eq, ilike, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db/client';

export const revalidate = 3600;

const SCOPE_SITEMAP_LIMIT = 500; // top-N wildcard roots; keeps sitemap under Google's 50k cap
                                 // ponytail: single number, bump when it stops being enough

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/programs`, priority: 0.9 },
    { url: `${base}/scope-lookup`, priority: 0.8 },
    { url: `${base}/whats-new`, priority: 0.8 },
    { url: `${base}/reward-changes`, priority: 0.7 },
    { url: `${base}/how-scored`, priority: 0.6 },
    { url: `${base}/settings/discord`, priority: 0.4 },
    { url: `${base}/feed`, priority: 0.7 },
    { url: `${base}/programs/paying`, priority: 0.8 },
    { url: `${base}/programs/safe-harbor`, priority: 0.8 },
    { url: `${base}/programs/wildcard`, priority: 0.8 },
    { url: `${base}/how-it-works`, priority: 0.5 },
    { url: `${base}/mcp`, priority: 0.7 },
    { url: `${base}/compare`, priority: 0.6 },
    { url: `${base}/watchlist`, priority: 0.4 },
    { url: `${base}/platforms/hackerone`, priority: 0.7 },
    { url: `${base}/platforms/bugcrowd`, priority: 0.7 },
    { url: `${base}/platforms/intigriti`, priority: 0.7 },
    { url: `${base}/platforms/yeswehack`, priority: 0.7 },
    { url: `${base}/platforms/federacy`, priority: 0.7 },
    { url: `${base}/platforms/immunefi`, priority: 0.7 },
  ];

  try {
    const rows = await db
      .select({ platform: schema.programs.platform, slug: schema.programs.slug, updated: schema.programs.lastUpdatedAt })
      .from(schema.programs)
      .limit(10000);
    // URL-encode each path segment individually so `&`, spaces, and other XML/URL-hostile
    // characters in a slug (e.g. Bugcrowd's `at&t`) don't break the sitemap XML parser.
    // Slashes inside a slug (Bugcrowd's `engagements/foo` pattern) must be preserved — split, encode, rejoin.
    const encodeSlug = (s: string) => s.split('/').map(encodeURIComponent).join('/');
    const programEntries: MetadataRoute.Sitemap = rows.map((r) => ({
      url: `${base}/programs/${encodeURIComponent(r.platform)}/${encodeSlug(r.slug)}`,
      lastModified: r.updated ?? undefined,
      priority: 0.5,
    }));

    // Top wildcard roots → /scope/<root>. SQL does the extraction + count so we don't
    // ship thousands of identifiers back to JS just to group them.
    const scopeRows = await db
      .select({
        root: sql<string>`lower(substring(${schema.scopes.identifier} from 3))`,
        n: sql<number>`count(*)::int`,
      })
      .from(schema.scopes)
      .where(and(eq(schema.scopes.inScope, true), ilike(schema.scopes.identifier, '*.%')))
      .groupBy(sql`lower(substring(${schema.scopes.identifier} from 3))`)
      .orderBy(sql`count(*) DESC`)
      .limit(SCOPE_SITEMAP_LIMIT);
    const scopeEntries: MetadataRoute.Sitemap = scopeRows
      .filter((r) => /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+$/.test(r.root))
      .map((r) => ({ url: `${base}/scope/${encodeURIComponent(r.root)}`, priority: 0.5 }));

    return [...staticEntries, ...programEntries, ...scopeEntries];
  } catch {
    return staticEntries;
  }
}
