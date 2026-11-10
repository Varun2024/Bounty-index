import { CHART } from './chart';

export interface BucketBar {
  label: string;
  value: number;
  highlight?: boolean; // e.g. the band holding the median — painted at full accent
}

interface BucketBarsProps {
  bars: BucketBar[];
  ariaLabel: string;
  unit?: string; // noun for the hover title, e.g. "payouts"
  heightClass?: string; // tailwind height for the plot
}

// The house distribution chart: a single-accent magnitude histogram. No legend (the caption names
// it), the highlighted band at full accent and the rest receding so "where it clusters" reads at a
// glance. Server-rendered inline SVG with native <title> hover; no charting dependency. Shared by
// the program-detail payout histogram and the home corpus chart so both read as one system.
export function BucketBars({ bars, ariaLabel, unit = '', heightClass = 'h-14' }: BucketBarsProps) {
  const peak = Math.max(1, ...bars.map((b) => b.value));
  const SLOT = 10;
  const BAR = 8;
  const PLOT = 48;
  const TOP = 3;
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${bars.length * SLOT} ${PLOT + TOP}`}
        preserveAspectRatio="none"
        className={`w-full ${heightClass}`}
        role="img"
        aria-label={ariaLabel}
      >
        <line
          x1={0}
          y1={TOP + PLOT}
          x2={bars.length * SLOT}
          y2={TOP + PLOT}
          stroke={CHART.baseline}
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
        {bars.map((b, i) => {
          const h = (b.value / peak) * PLOT;
          return (
            <rect
              key={b.label}
              x={i * SLOT}
              y={TOP + (PLOT - h)}
              width={BAR}
              height={h}
              rx={1.5}
              fill={b.value === 0 ? CHART.zero : b.highlight ? CHART.accent : CHART.accentMuted}
            >
              <title>{`${b.label}: ${b.value.toLocaleString()}${unit ? ` ${unit}` : ''}${b.highlight ? ' · median here' : ''}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="flex mt-1">
        {bars.map((b) => (
          <span
            key={b.label}
            className={`mono text-[8px] tabular-nums text-center ${b.highlight ? 'text-emerald-300' : 'text-neutral-400'}`}
            style={{ width: `${100 / bars.length}%` }}
          >
            {b.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
