import { shortenIdentifier } from '@/lib/format';

// Data-as-atmosphere: a sparse, scattered set of real in-scope identifiers ghosted behind
// the hero, proving the index is real in the texture itself. No other site can render this,
// it's our data. Styling + float + reduced-motion live in globals.css (.hdb-item). Positions
// are hand-placed slots (not random) so they sit in the hero's negative space, clear of the
// H1 and leaderboard, and stay stable across SSR/hydration. On empty we show only the glow,
// never fabricated domains.

interface Slot {
  top: number;   // %
  left: number;  // %
  size: number;  // px
  opacity: number;
  blur: number;  // px
}

// Three depth tiers (near = larger/clearer, far = smaller/fainter/blurred), spread across
// the top strip, left gutter, and lower band — the zones the hero content doesn't occupy.
const SLOTS: Slot[] = [
  { top: 7,  left: 7,  size: 16, opacity: 0.038, blur: 0.3 },
  { top: 11, left: 34, size: 13, opacity: 0.024, blur: 0.6 },
  { top: 8,  left: 60, size: 15, opacity: 0.030, blur: 0.4 },
  { top: 8,  left: 83, size: 14, opacity: 0.028, blur: 0.5 },
  { top: 6,  left: 93, size: 13, opacity: 0.022, blur: 0.7 },
  { top: 48, left: 2,  size: 18, opacity: 0.040, blur: 0.2 },
  { top: 80, left: 9,  size: 22, opacity: 0.050, blur: 0 },
  { top: 90, left: 31, size: 14, opacity: 0.026, blur: 0.5 },
  { top: 84, left: 50, size: 16, opacity: 0.032, blur: 0.3 },
  { top: 88, left: 69, size: 19, opacity: 0.040, blur: 0.1 },
  { top: 93, left: 88, size: 13, opacity: 0.022, blur: 0.6 },
];

export function HeroDataBackdrop({ identifiers }: { identifiers: string[] }) {
  const ids = identifiers.filter(Boolean);

  return (
    <div className="hero-data-backdrop" aria-hidden>
      <div className="hero-data-backdrop__glow" />
      {ids.length > 0 &&
        SLOTS.map((s, i) => {
          const id = ids[i % ids.length];
          if (!id) return null;
          return (
            <span
              key={i}
              className="hdb-item mono"
              style={{
                top: `${s.top}%`,
                left: `${s.left}%`,
                fontSize: `${s.size}px`,
                opacity: s.opacity,
                filter: s.blur ? `blur(${s.blur}px)` : undefined,
                animationDuration: `${9 + (i % 5) * 1.3}s`,
                animationDelay: `${((i * 0.9) % 4).toFixed(1)}s`,
              }}
            >
              {shortenIdentifier(id, 24)}
            </span>
          );
        })}
    </div>
  );
}
