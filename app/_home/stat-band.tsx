import { stats, topPayouts } from '@/lib/db/queries';
import { formatBounty } from '@/lib/format';

interface StatBandProps {
  s: Awaited<ReturnType<typeof stats>> | null;
  top: Awaited<ReturnType<typeof topPayouts>>;
  mcpRequests: number;
}

// A bold proof band of real numbers, the index stated at full size. Big accent figure leads,
// the rest in bright ink; labels muted. Pure type and data, no decoration. Every value is live
// (R-17: no invented numbers); the band renders nothing if stats are unavailable.
export function StatBand({ s, top, mcpRequests }: StatBandProps) {
  if (!s) return null;

  const items: { value: string; label: string; accent?: boolean }[] = [
    { value: s.programs.toLocaleString(), label: 'programs indexed', accent: true },
    { value: s.bountyPrograms.toLocaleString(), label: 'paying cash right now' },
    { value: s.inScopeAssets.toLocaleString(), label: 'in-scope assets' },
    { value: String(s.platforms), label: 'platforms, one index' },
  ];
  if (top[0]) {
    items.push({ value: formatBounty(top[0].maxBounty, top[0].currency ?? 'USD'), label: 'biggest stated max' });
  }
  if (mcpRequests > 0) {
    items.push({ value: mcpRequests.toLocaleString(), label: 'agent requests served' });
  }

  return (
    <section className="border-t border-neutral-900">
      <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24">
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-12">
          {items.map((it) => (
            <div key={it.label}>
              <dd
                className={`mono tabular-nums text-5xl md:text-6xl font-semibold tracking-tight leading-[0.95] ${
                  it.accent ? 'text-emerald-300' : 'text-neutral-50'
                }`}
              >
                {it.value}
              </dd>
              <dt className="mt-3 text-sm md:text-base text-neutral-400">{it.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
