import { newestPrograms } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META } from '@/lib/format';

export async function Ticker() {
  let rows: Awaited<ReturnType<typeof newestPrograms>> = [];
  try {
    rows = await newestPrograms(20);
  } catch {
    return null;
  }
  if (rows.length === 0) return null;

  // Duplicate the list so the marquee loops seamlessly
  const doubled = [...rows, ...rows];

  return (
    <div className="border-y border-neutral-900 bg-neutral-950/60 overflow-hidden relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-[#0a0a0b] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-[#0a0a0b] to-transparent" />
      <div className="flex items-center gap-4 md:gap-6 px-4 md:px-8 py-4 md:py-5 mono text-xs text-neutral-500">
        <span className="mono text-[10px] uppercase tracking-widest text-emerald-400 shrink-0 inline-flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Live · latest
        </span>
        <span className="h-5 w-px bg-neutral-800 shrink-0" />
        <div className="flex-1 overflow-hidden min-w-0">
          <div className="flex gap-14 w-max animate-[marquee_60s_linear_infinite] whitespace-nowrap py-0.5">
            {doubled.map((p, i) => (
              <span key={`${p.id}-${i}`} className="inline-flex items-center gap-2.5 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500'}`} />
                <span className="text-neutral-300">{p.name}</span>
                <span className="text-neutral-700">·</span>
                <span className="text-neutral-500">{platformLabel(p.platform)}</span>
                <span className="text-neutral-700">·</span>
                <span className={p.maxBounty ? 'text-emerald-300' : 'text-neutral-600'}>
                  {formatBounty(p.maxBounty, p.currency ?? 'USD')}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
