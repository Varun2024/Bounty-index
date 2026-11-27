'use client';

// Client event sink. Replaces Vercel's `track()` after the Cloudflare migration.
// Fire-and-forget POST to /api/track, which writes to the Cloudflare Analytics Engine dataset.
// sendBeacon survives page navigation (ideal for funnel events); fetch(keepalive) is the fallback.
type Props = Record<string, string | number | boolean>;

export function track(event: string, props?: Props): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({ event, props });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
      return;
    }
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never let analytics throw into the UI
  }
}
