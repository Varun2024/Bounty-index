import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Custom-event sink for the Discord-setup funnel (replaces Vercel's track()).
// Client `track()` POSTs here; this writes one data point to the ANALYTICS Engine dataset.
// Public endpoint, so validate strictly and cap sizes — never trust the body.
const schema = z.object({
  event: z.string().regex(/^[a-z0-9_]{1,40}$/),
  props: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

// Typed locally so we don't pull workerd's global runtime types into the Next app's type
// environment (cf-typegen's generated globals clash with the DOM lib Next relies on).
interface AnalyticsEngineBinding {
  writeDataPoint(event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { event, props } = parsed.data;

  try {
    const { env } = getCloudflareContext();
    const analytics = (env as Record<string, unknown>).ANALYTICS as AnalyticsEngineBinding | undefined;
    // writeDataPoint: blobs <=5120B total, index <=96B. event is <=40 chars.
    analytics?.writeDataPoint({
      blobs: [event, props ? JSON.stringify(props).slice(0, 512) : ''],
      doubles: [],
      indexes: [event],
    });
  } catch {
    // Analytics must never fail the client. Swallow and move on.
  }
  return NextResponse.json({ ok: true });
}
