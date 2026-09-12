import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Sanity check: does the running function see the env vars we expect?
// Reports presence and length only — never leaks values. Delete when done debugging.
// Gated by DEBUG_SECRET (set it yourself in Vercel dashboard to any string you'll remember).
// Usage: GET /api/_debug-env?secret=<value you set>
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.DEBUG_SECRET || secret !== process.env.DEBUG_SECRET) {
    return new NextResponse('not found', { status: 404 });
  }

  const keys = ['DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET', 'CRON_SECRET'];
  const status: Record<string, { present: boolean; length: number }> = {};
  for (const k of keys) {
    const v = process.env[k];
    status[k] = { present: !!v, length: v?.length ?? 0 };
  }
  return NextResponse.json({ env: status, region: process.env.VERCEL_REGION ?? 'unknown' });
}
