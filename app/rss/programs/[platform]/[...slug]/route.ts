import { getProgramBySlug, getProgramSnapshots } from '@/lib/db/queries';
import { diffSnapshots, isEmptyDiff } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

interface RouteContext {
  params: Promise<{ platform: string; slug: string[] }>;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const { platform, slug } = await ctx.params;
  const fullSlug = slug.join('/');
  const result = await getProgramBySlug(platform, fullSlug).catch(() => null);
  if (!result) return new Response('Not found', { status: 404 });

  const origin = new URL(req.url).origin;
  const encodeSlug = (s: string) => s.split('/').map(encodeURIComponent).join('/');
  const programLink = `${origin}/programs/${encodeURIComponent(platform)}/${encodeSlug(fullSlug)}`;

  const snapshots = await getProgramSnapshots(result.program.id);

  // Emit one <item> per non-empty diff between consecutive snapshots (oldest → newest).
  // Use snapshot capturedAt for guid uniqueness so feed readers dedupe cleanly.
  const items: string[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const cur = snapshots[i];
    const diff = diffSnapshots(prev.payload, cur.payload);
    if (!diff || isEmptyDiff(diff)) continue;

    const parts: string[] = [];
    if (diff.added.length) parts.push(`+${diff.added.length} added: ${diff.added.slice(0, 10).join(', ')}${diff.added.length > 10 ? `, +${diff.added.length - 10} more` : ''}`);
    if (diff.removed.length) parts.push(`−${diff.removed.length} removed: ${diff.removed.slice(0, 10).join(', ')}${diff.removed.length > 10 ? `, +${diff.removed.length - 10} more` : ''}`);
    if (diff.rewardDelta) parts.push(`Max reward: ${diff.rewardDelta.from ?? '—'} → ${diff.rewardDelta.to ?? '—'}`);
    if (diff.safeHarborChanged) parts.push(`Safe harbor: ${diff.safeHarborChanged.from ?? '—'} → ${diff.safeHarborChanged.to ?? '—'}`);

    const titleBits: string[] = [];
    if (diff.added.length) titleBits.push(`+${diff.added.length}`);
    if (diff.removed.length) titleBits.push(`−${diff.removed.length}`);
    if (diff.rewardDelta) titleBits.push('reward change');
    if (diff.safeHarborChanged) titleBits.push('safe-harbor change');
    const title = `${result.program.name} · ${titleBits.join(' · ')}`;

    const capturedAt = new Date(cur.capturedAt);
    items.push(`<item>
  <title>${esc(title)}</title>
  <link>${programLink}</link>
  <guid isPermaLink="false">${programLink}#${capturedAt.getTime()}</guid>
  <pubDate>${capturedAt.toUTCString()}</pubDate>
  <description>${esc(parts.join(' · '))}</description>
</item>`);
  }

  // Newest first — feed readers expect reverse chronological.
  items.reverse();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(result.program.name)} — scope changes</title>
    <link>${programLink}</link>
    <description>Scope, reward, and safe-harbor changes for ${esc(result.program.name)} on ${esc(platform)}.</description>
    <language>en-us</language>
    ${items.join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=600',
    },
  });
}
