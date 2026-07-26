import { NextResponse } from 'next/server';
import { ingestAll } from '@/lib/ingest/bounty-targets';

export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const results = await ingestAll();
  return NextResponse.json({ ok: true, results });
}
