import { newestPrograms } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const rows = await newestPrograms(50);

  const items = rows
    .map((p) => {
      const link = `${origin}/programs/${p.platform}/${p.slug}`;
      const pubDate = p.firstSeenAt ? new Date(p.firstSeenAt).toUTCString() : new Date().toUTCString();
      const bounty = p.maxBounty ? ` — up to $${p.maxBounty.toLocaleString()}` : '';
      const desc = `${p.platform} · ${p.programType}${bounty}`;
      return `<item>
  <title>${esc(p.name)}</title>
  <link>${link}</link>
  <guid isPermaLink="true">${link}</guid>
  <pubDate>${pubDate}</pubDate>
  <description>${esc(desc)}</description>
</item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bounty Index — new programs</title>
    <link>${origin}</link>
    <description>Newly discovered bug bounty and VDP programs.</description>
    <language>en-us</language>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=600',
    },
  });
}
