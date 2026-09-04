import { getRecentChanges } from '@/lib/db/queries';
import { formatBounty } from '@/lib/format';

export const dynamic = 'force-dynamic';

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export async function GET(req: Request): Promise<Response> {
  const origin = new URL(req.url).origin;
  const all = await getRecentChanges(720, 1000);
  const changes = all.filter((c) => c.diff.rewardDelta);
  const encodeSlug = (s: string) => s.split('/').map(encodeURIComponent).join('/');

  const items = changes
    .map((c) => {
      const link = `${origin}/programs/${encodeURIComponent(c.program.platform)}/${encodeSlug(c.program.slug)}`;
      const currency = c.program.currency ?? 'USD';
      const delta = c.diff.rewardDelta!;
      const from = delta.from != null ? formatBounty(delta.from, currency) : '—';
      const to = delta.to != null ? formatBounty(delta.to, currency) : '—';
      const direction =
        delta.from != null && delta.to != null
          ? delta.to > delta.from
            ? '↑'
            : delta.to < delta.from
              ? '↓'
              : '·'
          : '★';
      const title = `${direction} ${c.program.name} · ${from} → ${to}`;
      const description = `Max reward changed from ${from} to ${to}.`;

      return `<item>
  <title>${esc(title)}</title>
  <link>${link}</link>
  <guid isPermaLink="false">${link}#reward-${c.capturedAt.getTime()}</guid>
  <pubDate>${c.capturedAt.toUTCString()}</pubDate>
  <description>${esc(description)}</description>
</item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bounty Index — reward changes</title>
    <link>${origin}/reward-changes</link>
    <description>Just the money moves. Every max-payout bump or cut across all indexed platforms.</description>
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
