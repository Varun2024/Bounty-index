import type { CSSProperties } from 'react';
import { shortenIdentifier } from '@/lib/format';

// Data-as-atmosphere: a sparse, scattered set of real in-scope identifiers ghosted behind
// the hero, proving the index is real in the texture itself. No other site can render this,
// it's our data. Styling + float + reduced-motion live in globals.css (.hdb-item). Positions
// and per-item motion are hand-placed (not random) so they sit in the hero's negative space,
// clear of the H1 and leaderboard, stay stable across SSR/hydration, and drift independently
// (varied amplitude/direction/duration/delay) so nothing pulses in lockstep. On empty we show
// only the glow, never fabricated domains.

interface Slot {
  top: number;      // %
  left: number;     // %
  size: number;     // px
  opacity: number;
  blur: number;     // px
  amp: number;      // float amplitude px (negative = up)
  dx: number;       // horizontal drift px
  dur: number;      // float duration s
  delay: number;    // float delay s
}

// Depth tiers (near = larger/clearer, far = smaller/fainter/blurred), spread across the top
// strip, left gutter, and lower band. Motion fields are deliberately out of phase.
const SLOTS: Slot[] = [
  { top: 7,  left: 7,  size: 16, opacity: 0.038, blur: 0.3, amp: -13, dx: 2,  dur: 9.5,  delay: 0 },
  { top: 11, left: 34, size: 13, opacity: 0.024, blur: 0.6, amp: -16, dx: -3, dur: 13,   delay: 2.4 },
  { top: 8,  left: 60, size: 15, opacity: 0.030, blur: 0.4, amp: -10, dx: 2,  dur: 8,    delay: 4.1 },
  { top: 8,  left: 83, size: 14, opacity: 0.028, blur: 0.5, amp: -14, dx: -2, dur: 11.5, delay: 1.2 },
  { top: 6,  left: 93, size: 13, opacity: 0.022, blur: 0.7, amp: -12, dx: 3,  dur: 15,   delay: 3.3 },
  { top: 48, left: 2,  size: 18, opacity: 0.040, blur: 0.2, amp: -15, dx: -2, dur: 10,   delay: 0.7 },
  { top: 80, left: 9,  size: 22, opacity: 0.050, blur: 0,   amp: -11, dx: 3,  dur: 12.5, delay: 2.9 },
  { top: 90, left: 31, size: 14, opacity: 0.026, blur: 0.5, amp: -16, dx: -3, dur: 9,    delay: 5 },
  { top: 84, left: 50, size: 16, opacity: 0.032, blur: 0.3, amp: -9,  dx: 2,  dur: 14,   delay: 1.7 },
  { top: 88, left: 69, size: 19, opacity: 0.040, blur: 0.1, amp: -13, dx: -2, dur: 10.5, delay: 3.8 },
  { top: 93, left: 88, size: 13, opacity: 0.022, blur: 0.6, amp: -15, dx: 3,  dur: 12,   delay: 0.4 },
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
          const style = {
            top: `${s.top}%`,
            left: `${s.left}%`,
            fontSize: `${s.size}px`,
            opacity: s.opacity,
            filter: s.blur ? `blur(${s.blur}px)` : undefined,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            '--amp': `${s.amp}px`,
            '--dx': `${s.dx}px`,
          } as CSSProperties;
          return (
            <span key={i} className="hdb-item mono" style={style}>
              {shortenIdentifier(id, 24)}
            </span>
          );
        })}
    </div>
  );
}
