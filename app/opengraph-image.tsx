import { siteOgCard, OG_SIZE, OG_ALT } from '@/lib/og-card';

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = 'image/png';
// ISR, not force-static: a static card would freeze the build-time fallback (no DB at build).
export const revalidate = 86400;

export default function OG(): Promise<Response> {
  return siteOgCard();
}
