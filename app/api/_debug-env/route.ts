import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';

// Admin-only sanity check: does the running function see the env vars we expect?
// Reports presence and length only — never leaks values. Delete when done debugging.
export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) return new NextResponse('not found', { status: 404 });

  const keys = ['DATABASE_URL', 'BLOB_READ_WRITE_TOKEN', 'AUTH_SECRET', 'AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'];
  const status: Record<string, { present: boolean; length: number }> = {};
  for (const k of keys) {
    const v = process.env[k];
    status[k] = { present: !!v, length: v?.length ?? 0 };
  }
  return NextResponse.json({ env: status, region: process.env.VERCEL_REGION ?? 'unknown' });
}
