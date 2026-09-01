import { SectionEyebrow } from './shared';

interface CompareRow {
  name: string;
  coverage: string;
  sort: string;
  lookup: string;
  mcp: string;
  keyboard: string;
  active?: boolean;
}

export function Comparison() {
  const rows: CompareRow[] = [
    { name: 'bounty.index', coverage: '5 of 5 · unified', sort: '✓ max payout', lookup: '✓ one query', mcp: '✓ /mcp endpoint', keyboard: '✓ / j k ↵', active: true },
    { name: 'HackerOne directory', coverage: '1 of 5', sort: 'severity only', lookup: '✗', mcp: '✗', keyboard: '✗' },
    { name: 'Bugcrowd programs page', coverage: '1 of 5', sort: '✓ max payout', lookup: '✗', mcp: '✗', keyboard: '✗' },
    { name: 'disclose.io', coverage: 'VDP policies only', sort: '✗', lookup: '✗', mcp: '✗', keyboard: '✗' },
    { name: 'bounty-targets-data', coverage: '5 of 5 · raw JSON', sort: 'grep + jq', lookup: 'grep + jq', mcp: '✗', keyboard: 'n/a' },
  ];
  return (
    <section className="border-t border-neutral-900 bg-neutral-950/40 relative">
      <div
        className="absolute pointer-events-none inset-0 opacity-30"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />
      <div className="relative max-w-[1200px] mx-auto px-6 py-28">
        <div className="reveal">
          <SectionEyebrow n="02" label="Why this exists" />
          <h2 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight text-neutral-50 max-w-3xl">
            Every alternative is <span className="text-neutral-500">fragmented.</span>
          </h2>
          <p className="mt-5 text-neutral-400 max-w-2xl leading-relaxed">
            Each platform shows its own programs. Directories are stale or policy-only. Raw JSON is fine
            if you enjoy <code className="mono text-neutral-300">jq</code>. And none of them speak
            <code className="mono text-neutral-300"> MCP</code>. This is the one built for scanning — by you or your agent.
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
                {[
                  { k: 'Coverage', v: r.coverage },
                  { k: 'Sort by payout', v: r.sort },
                  { k: 'Scope lookup', v: r.lookup },
                  { k: 'MCP / agent access', v: r.mcp },
                  { k: 'Keyboard nav', v: r.keyboard },
                ].map((cell) => (
                  <div key={cell.k} className="flex items-center justify-between px-4 py-2.5">
                    <dt className="mono text-[10px] uppercase tracking-widest text-neutral-500">{cell.k}</dt>
                    <dd className={`mono text-xs ${cellColor(cell.v, r.active)}`}>{cell.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="mt-14 border border-neutral-900 rounded-xl overflow-hidden bg-neutral-950/60 hidden md:block">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_1.1fr_1fr] mono text-[10px] uppercase tracking-widest text-neutral-500 border-b border-neutral-900 bg-neutral-950">
            <div className="px-5 py-3.5">Source</div>
            <div className="px-4 py-3.5">Coverage</div>
            <div className="px-4 py-3.5">Sort by payout</div>
            <div className="px-4 py-3.5">Scope lookup</div>
            <div className="px-4 py-3.5">MCP / agent access</div>
            <div className="px-5 py-3.5">Keyboard nav</div>
          </div>
          {rows.map((r) => (
            <div
              key={r.name}
              className={`grid grid-cols-[1.4fr_1fr_1fr_1fr_1.1fr_1fr] text-sm border-b border-neutral-900 last:border-b-0 ${
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
              <CompareCell value={r.coverage} active={r.active} />
              <CompareCell value={r.sort} active={r.active} />
              <CompareCell value={r.lookup} active={r.active} />
              <CompareCell value={r.mcp} active={r.active} />
              <CompareCell value={r.keyboard} active={r.active} />
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
