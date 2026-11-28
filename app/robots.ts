import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return {
    // Allow the machine-readable dataset export to be crawled/fetched (it's the Dataset
    // distribution declared in JSON-LD); keep the rest of /api private.
    // /settings/* is per-user and login-gated: no crawl value, and bots were burning 3k+ hits on it.
    rules: [{ userAgent: '*', allow: ['/', '/api/export/'], disallow: ['/api/', '/settings/'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
