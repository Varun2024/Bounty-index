import { siteOgCard } from '@/lib/og-card';

// Site-wide default share card for inner pages that have no OG of their own. Referenced from
// the root metadata (openGraph/twitter images), replacing the static, hand-drawn og.png so the
// fallback stays current. Served at /og/default; cached and revalidated like the homepage card.
export const revalidate = 86400;

export function GET(): Promise<Response> {
  return siteOgCard();
}
