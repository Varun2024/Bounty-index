interface ScopeMixBarProps {
  mix: { type: string; count: number }[];
}

// ponytail: color-per-asset-type is a map, not a function. Adding a type? one line.
const COLORS: Record<string, string> = {
  wildcard: '#34d399',       // emerald-400
  url: '#60a5fa',            // blue-400
  api: '#22d3ee',            // cyan-400
  android: '#fb923c',        // orange-400
  ios: '#f472b6',            // pink-400
  source_code: '#a78bfa',    // violet-400
  hardware: '#f87171',       // red-400
  smart_contract: '#facc15', // yellow-400
  other: '#737373',          // neutral-500
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
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500">Attack surface</p>
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
          {total} in-scope
        </p>
      </div>
      <div
        className="flex h-2.5 rounded-full overflow-hidden border border-neutral-900 bg-neutral-950"
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
            <li key={b.type} className="inline-flex items-center gap-1.5 text-neutral-500">
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
