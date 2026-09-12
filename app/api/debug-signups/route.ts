import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listPendingSignups } from '@/lib/signup-queue';

// Read the pending-signups Blob queue without needing an admin session
// (sign-in is broken during the outage, so /admin isn't reachable).
// Gated by DEBUG_SECRET so it's not a public endpoint.
// Usage: GET /api/debug-signups?secret=<DEBUG_SECRET value>
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.DEBUG_SECRET || secret !== process.env.DEBUG_SECRET) {
    return new NextResponse('not found', { status: 404 });
  }
  const signups = await listPendingSignups().catch((e) => {
    return { error: e instanceof Error ? e.message : 'list failed' };
  });
  return NextResponse.json({ count: Array.isArray(signups) ? signups.length : 0, signups });
}
