import { getWatchlist } from '@/lib/db/queries';
import { diffSnapshots, isEmptyDiff } from '@/lib/snapshots';
import { formatBounty } from '@/lib/format';

export const dynamic = 'force-dynamic';

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

function parseIds(v: string | null): number[] {
  if (!v) return [];
  return v
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 200); // ponytail: cap the URL-driven fan-out; nobody watches 200 programs
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const origin = url.origin;
  const ids = parseIds(url.searchParams.get('ids'));
  const encodeSlug = (s: string) => s.split('/').map(encodeURIComponent).join('/');

  // Empty ids = valid empty feed (reader subscribed before watching anything).
  const entries = ids.length ? await getWatchlist(ids) : [];

  const items = entries
    .map((e) => {
      const diff = diffSnapshots(e.previous, e.latest);
      if (isEmptyDiff(diff) || !diff) return null;
      const cur = e.latest!.currency ?? 'USD';
      const link = `${origin}/programs/${encodeURIComponent(e.program.platform)}/${encodeSlug(e.program.slug)}`;

      const parts: string[] = [];
      if (diff.added.length) parts.push(`+${diff.added.length} added: ${diff.added.slice(0, 10).join(', ')}${diff.added.length > 10 ? `, +${diff.added.length - 10} more` : ''}`);
      if (diff.removed.length) parts.push(`−${diff.removed.length} removed: ${diff.removed.slice(0, 10).join(', ')}${diff.removed.length > 10 ? `, +${diff.removed.length - 10} more` : ''}`);
      if (diff.rewardDelta) parts.push(`Max reward: ${diff.rewardDelta.from ? formatBounty(diff.rewardDelta.from, cur) : '—'} → ${diff.rewardDelta.to ? formatBounty(diff.rewardDelta.to, cur) : '—'}`);
      if (diff.safeHarborChanged) parts.push(`Safe harbor: ${diff.safeHarborChanged.from ?? '—'} → ${diff.safeHarborChanged.to ?? '—'}`);

      const titleBits: string[] = [];
      if (diff.added.length) titleBits.push(`+${diff.added.length}`);
      if (diff.removed.length) titleBits.push(`−${diff.removed.length}`);
      if (diff.rewardDelta) titleBits.push('reward change');
      if (diff.safeHarborChanged) titleBits.push('safe-harbor change');
      const title = `${e.program.name} · ${titleBits.join(' · ')}`;

      const when = e.latestAt ?? new Date();
      return `<item>
  <title>${esc(title)}</title>
  <link>${link}</link>
  <guid isPermaLink="false">${link}#${when.getTime()}</guid>
  <pubDate>${when.toUTCString()}</pubDate>
  <description>${esc(parts.join(' · '))}</description>
</item>`;
    })
    .filter((x): x is string => x !== null)
    .join('\n');

  const selfHref = `${origin}/watchlist.xml${ids.length ? `?ids=${ids.join(',')}` : ''}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bounty Index — watchlist changes</title>
    <link>${origin}/watchlist${ids.length ? `?ids=${ids.join(',')}` : ''}</link>
    <description>Scope, reward, and safe-harbor changes for the programs you watch.</description>
    <language>en-us</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${esc(selfHref)}" rel="self" type="application/rss+xml" />
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
