import { NextResponse } from 'next/server';
import { listPrograms } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

// Lightweight name-search endpoint. Used by the Discord settings form's program picker.
// Public read; no auth. Rate-limited implicitly by the host.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const limitRaw = Number(url.searchParams.get('limit') ?? '10');
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? limitRaw : 10;
  if (!q || q.length < 2) return NextResponse.json({ rows: [] });

  const result = await listPrograms({ q, sort: 'name', page: 1, pageSize: limit }).catch(() => ({ rows: [] as Array<{ id: number; name: string; platform: string; slug: string }> }));
  return NextResponse.json({
    rows: result.rows.map((r) => ({ id: r.id, name: r.name, platform: r.platform, slug: r.slug })),
  });
}
