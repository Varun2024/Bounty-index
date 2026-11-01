import { ImageResponse } from 'next/og';
import { getProgramBySlug } from '@/lib/db/queries';
import { formatPayoutRange, platformLabel } from '@/lib/format';

// Per-program OG card as a route handler. The metadata-file convention (opengraph-image.tsx)
// isn't allowed after a catch-all segment, so the detail page's generateMetadata points its
// openGraph.images here instead. Served at /og/<platform>/<slug...>.
export const revalidate = 86400;

const SIZE = { width: 1200, height: 630 };

const PLATFORM_DOTS: Record<string, string> = {
  hackerone: '#34d399',
  bugcrowd: '#fb923c',
  intigriti: '#60a5fa',
  immunefi: '#f472b6',
  yeswehack: '#facc15',
  federacy: '#a78bfa',
  hackenproof: '#e879f9',
};

interface RouteContext {
  params: Promise<{ platform: string; slug: string[] }>;
}

export async function GET(_req: Request, { params }: RouteContext): Promise<Response> {
  const { platform, slug } = await params;
  const result = await getProgramBySlug(platform, slug.join('/')).catch(() => null);

  const name = result?.program.name ?? 'Bug bounty program';
  const plat = result?.program.platform ?? platform;
  const label = platformLabel(plat);
  const dot = PLATFORM_DOTS[plat] ?? '#737373';
  const offersBounty = result?.program.offersBounty ?? false;
  const range = result
    ? formatPayoutRange(result.program.minBounty, result.program.maxBounty, result.program.currency ?? 'USD')
    : null;
  const payout = range ? (range.label === 'payout up to' ? `up to ${range.value}` : range.value) : '';
  const inScopeCount = result ? result.scopes.filter((s) => s.inScope).length : 0;
  const safeHarbor = !!result?.program.safeHarbor && result.program.safeHarbor !== 'none';
  const displayName = name.length > 42 ? name.slice(0, 40) + '…' : name;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'monospace',
          padding: '56px 64px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(#262626 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            opacity: 0.4,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, color: '#34d399', letterSpacing: 4, zIndex: 1 }}>
          <span>§</span>
          <span>BOUNTY.INDEX</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 24, color: '#a3a3a3' }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: dot }} />
            <span>{label}</span>
            <span style={{ color: '#404040' }}>·</span>
            <span>{offersBounty ? 'bug bounty' : 'VDP'}</span>
          </div>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.02, color: '#fafafa', letterSpacing: -2, fontFamily: 'sans-serif' }}>
            {displayName}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 24, color: '#737373', zIndex: 1 }}>
          {payout && (
            <>
              <span style={{ color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>{payout}</span>
              <span style={{ color: '#404040' }}>·</span>
            </>
          )}
          <span style={{ color: '#fafafa', fontVariantNumeric: 'tabular-nums' }}>{inScopeCount.toLocaleString()}</span>
          <span>in-scope asset{inScopeCount === 1 ? '' : 's'}</span>
          {safeHarbor && (
            <>
              <span style={{ color: '#404040' }}>·</span>
              <span style={{ color: '#34d399' }}>safe harbor</span>
            </>
          )}
        </div>
      </div>
    ),
    { ...SIZE },
  );
}
