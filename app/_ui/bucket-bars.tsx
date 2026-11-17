import { scaleBand, scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import { CHART } from './chart';

export interface BucketBar {
  label: string;
  value: number;
  highlight?: boolean; // the band holding the median — the semantic focal point
}

interface BucketBarsProps {
  bars: BucketBar[];
  ariaLabel: string;
  unit?: string; // noun for the hover title, e.g. "payouts"
  heightClass?: string; // retained for call-site compatibility; height now follows the aspect ratio
}

// House distribution chart, built on visx scales. Designed, not decorative: every non-zero band is
// directly value-labelled (counts in tabular mono), the median band is the one emerald-and-gradient
// mark while the rest sit in a solid recessive tint (no washed translucency), and empty bands keep a
// baseline stub so "zero" reads as zero, not missing. Fixed viewBox scaled with `meet`, so the SVG
// text stays crisp and circles/curves aren't distorted. Server-rendered; native <title> hover.
const W = 480;
const H = 132;
const M = { top: 20, bottom: 18 };
const PLOT_H = H - M.top - M.bottom;

// Solid recessive fill for context bars: the accent mixed down into the surface, so it reads as a
// real tint on both the white and the near-black chart surface (not a see-through overlay).
const CONTEXT_FILL = 'color-mix(in srgb, var(--ck-accent) 34%, var(--ck-ring))';

export function BucketBars({ bars, ariaLabel, unit = '' }: BucketBarsProps) {
  const peak = Math.max(1, ...bars.map((b) => b.value));
  const x = scaleBand({ domain: bars.map((b) => b.label), range: [0, W], paddingInner: 0.34 });
  const y = scaleLinear({ domain: [0, peak], range: [PLOT_H, 0] });
  const bw = x.bandwidth();
  const baseline = M.top + PLOT_H;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
        <defs>
          {/* Median band: full at the tip, softening toward the baseline. */}
          <linearGradient id="bucketAccent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: CHART.accent, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: CHART.accent, stopOpacity: 0.65 }} />
          </linearGradient>
        </defs>

        <line x1={0} y1={baseline} x2={W} y2={baseline} style={{ stroke: CHART.baseline }} strokeWidth={1} />

        {bars.map((b) => {
          const bx = x(b.label) ?? 0;
          const cx = bx + bw / 2;
          const isZero = b.value === 0;
          const h = isZero ? 3 : Math.max(4, PLOT_H - (y(b.value) ?? 0));
          const by = baseline - h;
          const fill = isZero ? CHART.zero : b.highlight ? 'url(#bucketAccent)' : CONTEXT_FILL;
          return (
            <g key={b.label}>
              <Bar x={bx} y={by} width={bw} height={h} rx={3} style={{ fill }}>
                <title>{`${b.label}: ${b.value.toLocaleString()}${unit ? ` ${unit}` : ''}${b.highlight ? ' · median here' : ''}`}</title>
              </Bar>
              {!isZero && (
                <text
                  x={cx}
                  y={by - 6}
                  textAnchor="middle"
                  fontSize={12}
                  className="mono"
                  style={{ fill: b.highlight ? CHART.accent : CHART.axis, fontVariantNumeric: 'tabular-nums' }}
                >
                  {b.value.toLocaleString()}
                </text>
              )}
              <text
                x={cx}
                y={baseline + 13}
                textAnchor="middle"
                fontSize={10.5}
                className="mono"
                style={{ fill: b.highlight ? CHART.accent : CHART.axis }}
              >
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
