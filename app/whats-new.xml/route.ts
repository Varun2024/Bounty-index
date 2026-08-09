import { getRecentChanges } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  const changes = await getRecentChanges(168, 100);
  const encodeSlug = (s: string) => s.split('/').map(encodeURIComponent).join('/');

  const items = changes
    .map((c) => {
      const link = `${origin}/programs/${encodeURIComponent(c.program.platform)}/${encodeSlug(c.program.slug)}`;
      const parts: string[] = [];
      if (c.diff.added.length) {
        parts.push(`+${c.diff.added.length} added: ${c.diff.added.slice(0, 10).join(', ')}${c.diff.added.length > 10 ? `, +${c.diff.added.length - 10} more` : ''}`);
      }
      if (c.diff.removed.length) {
        parts.push(`−${c.diff.removed.length} removed: ${c.diff.removed.slice(0, 10).join(', ')}${c.diff.removed.length > 10 ? `, +${c.diff.removed.length - 10} more` : ''}`);
      }
      if (c.diff.rewardDelta) parts.push(`Max reward: ${c.diff.rewardDelta.from ?? '—'} → ${c.diff.rewardDelta.to ?? '—'}`);
      if (c.diff.safeHarborChanged) parts.push(`Safe harbor: ${c.diff.safeHarborChanged.from ?? '—'} → ${c.diff.safeHarborChanged.to ?? '—'}`);

      const titleBits: string[] = [];
      if (c.diff.added.length) titleBits.push(`+${c.diff.added.length}`);
      if (c.diff.removed.length) titleBits.push(`−${c.diff.removed.length}`);
      if (c.diff.rewardDelta) titleBits.push('reward change');
      if (c.diff.safeHarborChanged) titleBits.push('safe-harbor change');
      const title = `${c.program.name} · ${titleBits.join(' · ')}`;

      return `<item>
  <title>${esc(title)}</title>
  <link>${link}</link>
  <guid isPermaLink="false">${link}#${c.capturedAt.getTime()}</guid>
  <pubDate>${c.capturedAt.toUTCString()}</pubDate>
  <description>${esc(parts.join(' · '))}</description>
</item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bounty Index — what&apos;s new</title>
    <link>${origin}/whats-new</link>
    <description>Every scope, reward, and safe-harbor change across all indexed platforms.</description>
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
