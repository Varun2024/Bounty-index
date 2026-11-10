import { ImageResponse } from 'next/og';
import { stats, topPayouts } from '@/lib/db/queries';
import { formatBounty } from '@/lib/format';

// The site's default share card, rendered live. Used by the homepage opengraph-image and by
// /og/default (the fallback for every inner page that has no OG of its own), so both stay
// current instead of freezing a build-time or hand-drawn PNG.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = 'bounty.index: every public bounty, one index';

// The Scope Hound head mark, emerald, as a data URI so Satori can render it in the lockup.
export const HOUND_MARK = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">' +
    '<path d="M11.8 10.2 C6.8 10.5 5.2 16.6 6.8 22.4 C7.5 25 10.9 25 12.2 21.4" stroke="#34d399" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path d="M20.2 10.2 C25.2 10.5 26.8 16.6 25.2 22.4 C24.5 25 21.1 25 19.8 21.4" stroke="#34d399" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path d="M12 10.4 C12.4 6.8 19.6 6.8 20 10.4 C20.4 13.2 20 15.4 18.8 16.9 C18.4 19.8 18.7 22.6 16 23.3 C13.3 22.6 13.6 19.8 13.2 16.9 C12 15.4 11.6 13.2 12 10.4 Z" stroke="#34d399" stroke-width="1.7" stroke-linejoin="round"/>' +
    '<circle cx="13.9" cy="12.9" r="1.1" fill="#34d399"/>' +
    '<circle cx="18.1" cy="12.9" r="1.1" fill="#34d399"/>' +
    '<circle cx="16" cy="21.4" r="1.7" fill="#34d399"/>' +
    '</svg>',
).toString('base64')}`;

const FALLBACK = { programs: 1800, platforms: 7 };

const PLATFORM_DOTS: Record<string, string> = {
  hackerone: '#34d399',
  bugcrowd: '#fb923c',
  intigriti: '#60a5fa',
  immunefi: '#f472b6',
  yeswehack: '#facc15',
  federacy: '#a78bfa',
  hackenproof: '#e879f9',
};

// Shown only if the live top-payouts query fails at render time.
const FALLBACK_ROWS = [
  { name: 'Coinbase', platform: 'hackerone', payout: '$1M', active: true },
  { name: 'LayerZero', platform: 'immunefi', payout: '$15M' },
  { name: 'Shopify', platform: 'hackerone', payout: '$50K' },
  { name: 'TikTok', platform: 'bugcrowd', payout: '$10K' },
  { name: 'Intel', platform: 'intigriti', payout: '$100K' },
];

export async function siteOgCard(): Promise<ImageResponse> {
  const [live, top] = await Promise.all([
    stats().catch(() => null),
    topPayouts(5).catch(() => []),
  ]);

  const programs = (live?.programs ?? FALLBACK.programs).toLocaleString();
  const platforms = live?.platforms ?? FALLBACK.platforms;

  const rows = top.length
    ? top.map((p, i) => ({
        name: p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name,
        platform: p.platform,
        payout: formatBounty(p.maxBounty, p.currency ?? 'USD'),
        active: i === 0,
      }))
    : FALLBACK_ROWS;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#0a0a0a',
          color: '#fafafa',
          fontFamily: 'monospace',
          padding: '56px 64px',
          position: 'relative',
        }}
      >
        {/* dot grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(#262626 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            opacity: 0.4,
          }}
        />

        {/* left column */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 20, color: '#34d399', letterSpacing: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HOUND_MARK} width={34} height={34} alt="" style={{ marginTop: -2 }} />
            <span>BOUNTY.INDEX</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 108, fontWeight: 700, lineHeight: 1, color: '#fafafa', letterSpacing: -3, fontFamily: 'sans-serif' }}>
              every bounty,
            </div>
            <div style={{ fontSize: 108, fontWeight: 700, lineHeight: 1, color: '#34d399', letterSpacing: -3, fontFamily: 'sans-serif' }}>
              one index.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 20, color: '#737373' }}>
            <span style={{ color: '#fafafa' }}>{programs}</span>
            <span>programs</span>
            <span style={{ color: '#404040' }}>·</span>
            <span style={{ color: '#fafafa' }}>{platforms}</span>
            <span>platforms</span>
            <span style={{ color: '#404040' }}>·</span>
            <span>updated daily</span>
          </div>
        </div>

        {/* right column — live top payouts */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 440, marginLeft: 48, zIndex: 1, justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #262626',
              borderRadius: 10,
              background: 'rgba(10,10,10,0.6)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                padding: '12px 18px',
                borderBottom: '1px solid #262626',
                background: 'rgba(23,23,23,0.6)',
                fontSize: 12,
                letterSpacing: 3,
                color: '#737373',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ flex: 1 }}>paying the most</span>
              <span>reward</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px 18px',
                  borderBottom: '1px solid #171717',
                  background: r.active ? 'rgba(16,185,129,0.08)' : 'transparent',
                  borderLeft: r.active ? '2px solid #34d399' : '2px solid transparent',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: PLATFORM_DOTS[r.platform] ?? '#737373',
                  }}
                />
                <span style={{ flex: 1, fontSize: 20, color: r.active ? '#34d399' : '#fafafa', fontFamily: 'sans-serif', fontWeight: 500 }}>
                  {r.name}
                </span>
                <span style={{ fontSize: 18, color: '#d4d4d4', fontVariantNumeric: 'tabular-nums' }}>{r.payout}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', marginTop: 14, fontSize: 13, color: '#525252', justifyContent: 'space-between', letterSpacing: 2 }}>
            <span>$ bounty-index --top</span>
            <span>{programs} rows</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
