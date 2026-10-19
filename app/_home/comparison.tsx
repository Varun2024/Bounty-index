import { SectionEyebrow } from './shared';

interface CompareRow {
  name: string;
  coverage: string;
  lookup: string;
  history: string;
  community: string;
  mcp: string;
  active?: boolean;
}

const COLUMNS: { key: keyof Omit<CompareRow, 'name' | 'active'>; label: string }[] = [
  { key: 'coverage', label: 'Coverage' },
  { key: 'lookup', label: 'Scope lookup' },
  { key: 'history', label: 'Change log' },
  { key: 'community', label: 'Community data' },
  { key: 'mcp', label: 'Agent / MCP' },
];

export function Comparison() {
  const rows: CompareRow[] = [
    { name: 'bounty.index', coverage: '6 of 6 · unified', lookup: '✓ paste a domain', history: '✓ daily + RSS', community: '✓ response times', mcp: '✓ /mcp endpoint', active: true },
    { name: 'HackerOne directory', coverage: '1 of 6', lookup: '✗', history: '✗', community: '✗', mcp: '✗' },
    { name: 'Bugcrowd programs page', coverage: '1 of 6', lookup: '✗', history: '✗', community: '✗', mcp: '✗' },
    { name: 'disclose.io', coverage: 'VDP policies only', lookup: '✗', history: '✗', community: '✗', mcp: '✗' },
    { name: 'bounty-targets-data', coverage: '6 of 6 · raw JSON', lookup: 'grep + jq', history: 'git log', community: '✗', mcp: '✗' },
  ];
  return (
    <section className="border-t border-neutral-900 bg-neutral-950/40 relative">
      <div className="relative max-w-[1200px] mx-auto px-6 py-28">
        <div className="reveal">
          <SectionEyebrow n="02" label="Why this exists" />
          <h2 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight text-neutral-50 max-w-3xl">
            Every alternative is <span className="text-neutral-500">fragmented.</span>
          </h2>
          <p className="mt-5 text-neutral-400 max-w-2xl leading-relaxed">
            Platforms only list their own programs. Directories show policies, not live scope. Raw JSON
            means living in <code className="mono text-neutral-300">jq</code>. None of them tell you what
            changed overnight, whether a domain is in scope, or answer your agent over{' '}
            <code className="mono text-neutral-300">MCP</code>. This does all of it, across every platform,
            free and without an account.
          </p>
        </div>

        {/* Mobile: card stack */}
        <div className="mt-10 md:hidden space-y-3">
          {rows.map((r) => (
            <div
              key={r.name}
              className={`relative border rounded-xl overflow-hidden ${
                r.active
                  ? 'border-emerald-400/40 bg-emerald-400/[0.04]'
                  : 'border-neutral-900 bg-neutral-950/60'
              }`}
            >
              {r.active && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400" />}
              <div className="px-4 py-3 border-b border-neutral-900 flex items-center gap-2">
                {r.active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                <span className={r.active ? 'text-emerald-300 font-medium' : 'text-neutral-100'}>{r.name}</span>
              </div>
              <dl className="divide-y divide-neutral-900 text-sm">
                {COLUMNS.map((col) => (
                  <div key={col.key} className="flex items-center justify-between px-4 py-2.5">
                    <dt className="text-xs text-neutral-400">{col.label}</dt>
                    <dd className={`mono text-xs ${cellColor(r[col.key], r.active)}`}>{r[col.key]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="mt-14 border border-neutral-900 rounded-xl overflow-hidden bg-neutral-950/60 hidden md:block">
          <div className="grid grid-cols-[1.4fr_1.1fr_1.1fr_1fr_1.2fr_1.1fr] text-xs text-neutral-400 border-b border-neutral-900 bg-neutral-950">
            <div className="px-5 py-3.5">Source</div>
            {COLUMNS.map((col) => (
              <div key={col.key} className="px-4 py-3.5">{col.label}</div>
            ))}
          </div>
          {rows.map((r) => (
            <div
              key={r.name}
              className={`grid grid-cols-[1.4fr_1.1fr_1.1fr_1fr_1.2fr_1.1fr] text-sm border-b border-neutral-900 last:border-b-0 ${
                r.active ? 'bg-emerald-400/[0.04] relative' : ''
              }`}
            >
              {r.active && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400" />}
              <div className={`px-5 py-4 ${r.active ? 'text-emerald-300 font-medium' : 'text-neutral-100'}`}>
                {r.active ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {r.name}
                  </span>
                ) : (
                  r.name
                )}
              </div>
              {COLUMNS.map((col) => (
                <CompareCell key={col.key} value={r[col.key]} active={r.active} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function cellColor(value: string, active?: boolean): string {
  if (value.startsWith('✓')) return active ? 'text-emerald-300' : 'text-emerald-400/80';
  if (value === '✗') return 'text-neutral-700';
  return 'text-neutral-400';
}

function CompareCell({ value, active }: { value: string; active?: boolean }) {
  const isYes = value.startsWith('✓');
  const isNo = value === '✗';
  const cls = isYes
    ? active
      ? 'text-emerald-300'
      : 'text-emerald-400/80'
    : isNo
      ? 'text-neutral-700'
      : 'text-neutral-400';
  return <div className={`px-4 py-4 mono text-xs ${cls}`}>{value}</div>;
}
