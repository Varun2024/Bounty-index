// Client event sink. Replaces Vercel's `track()` after the Cloudflare migration.
//
// ponytail: no-op for now. Vercel's track() only recorded when deployed on Vercel; off-platform
// it was already a no-op, so this loses nothing versus the current deployed-elsewhere state. The
// Discord-setup funnel events still flow through here, so wiring a real sink (Cloudflare Analytics
// Engine via an `ANALYTICS` binding, or a POST to an own /api/track route) is a one-file change.
export function track(_event: string, _props?: Record<string, unknown>): void {
  // intentionally empty
}
