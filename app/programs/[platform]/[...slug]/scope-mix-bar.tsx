import { CHART, CHART_SERIES } from '@/app/_ui/chart';

interface ScopeMixBarProps {
  mix: { type: string; count: number }[];
}

// Asset-type → a FIXED slot in the validated categorical ramp (entity-stable: "url" is the same
// blue on every program, never repainted by rank). Unknown types fall to the AA-safe neutral.
// ponytail: a map, not a function — adding a type is one line.
const COLORS: Record<string, string> = {
  url: CHART_SERIES[0], // blue
  api: CHART_SERIES[1], // orange
  wildcard: CHART_SERIES[2], // aqua
  android: CHART_SERIES[3], // yellow
  ios: CHART_SERIES[4], // magenta
  smart_contract: CHART_SERIES[5], // green
  source_code: CHART_SERIES[6], // violet
  hardware: CHART_SERIES[7], // red
  other: CHART.axis, // neutral-400 (was neutral-500 — failed AA)
};

const LABELS: Record<string, string> = {
  wildcard: 'wildcards',
  url: 'urls',
  api: 'apis',
  android: 'android',
  ios: 'ios',
  source_code: 'source',
  hardware: 'hardware',
  smart_contract: 'contracts',
  other: 'other',
};

export function ScopeMixBar({ mix }: ScopeMixBarProps) {
  const total = mix.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between mb-2">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-400">Attack surface</p>
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-400 tabular-nums">
          {total} in-scope
        </p>
      </div>
      {/* 2px gap between segments reveals the surface beneath — the secondary encoding that lets
          adjacent hues stay legible under colour-vision deficiency, paired with the labelled list below. */}
      <div
        className="flex h-2.5 rounded-full overflow-hidden border border-neutral-900 bg-neutral-950 gap-[2px]"
        role="img"
        aria-label={`Scope mix: ${mix.map((b) => `${b.count} ${LABELS[b.type] ?? b.type}`).join(', ')}`}
      >
        {mix.map((b) => {
          const pct = (b.count / total) * 100;
          const color = COLORS[b.type] ?? COLORS.other;
          const label = LABELS[b.type] ?? b.type;
          return (
            <div
              key={b.type}
              style={{ width: `${pct}%`, background: color }}
              title={`${b.count} ${label} · ${pct.toFixed(0)}%`}
            />
          );
        })}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 mono text-[11px]">
        {mix.map((b) => {
          const color = COLORS[b.type] ?? COLORS.other;
          const label = LABELS[b.type] ?? b.type;
          return (
            <li key={b.type} className="inline-flex items-center gap-1.5 text-neutral-400">
              <span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: color }}
              />
              <span className="text-neutral-300 tabular-nums">{b.count}</span>
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
