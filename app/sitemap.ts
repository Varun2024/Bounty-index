import type { MetadataRoute } from 'next';
import { db, schema } from '@/lib/db/client';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/programs`, priority: 0.9 },
    { url: `${base}/scope-lookup`, priority: 0.8 },
    { url: `${base}/feed`, priority: 0.7 },
    { url: `${base}/programs/paying`, priority: 0.8 },
    { url: `${base}/programs/safe-harbor`, priority: 0.8 },
    { url: `${base}/programs/wildcard`, priority: 0.8 },
    { url: `${base}/how-it-works`, priority: 0.5 },
    { url: `${base}/compare`, priority: 0.6 },
    { url: `${base}/watchlist`, priority: 0.4 },
  ];

  try {
    const rows = await db
      .select({ platform: schema.programs.platform, slug: schema.programs.slug, updated: schema.programs.lastUpdatedAt })
      .from(schema.programs)
      .limit(10000);
    const programEntries: MetadataRoute.Sitemap = rows.map((r) => ({
      url: `${base}/programs/${r.platform}/${r.slug}`,
      lastModified: r.updated ?? undefined,
      priority: 0.5,
    }));
    return [...staticEntries, ...programEntries];
  } catch {
    return staticEntries;
  }
}
