import Link from 'next/link';
import { listPrograms, type ProgramFilters } from '@/lib/db/queries';
import { formatBounty, platformLabel } from '@/lib/format';
import { PlatformLogo } from '@/app/_ui/platform-logo';

export interface PresetViewProps {
  h1: string;
  intro: string;
  filters: ProgramFilters;
  fullFilterHref: string;
}

// Shared body for pretty-URL preset pages. Renders unique content at each preset URL so
// search engines can index the H1 and description — the exact query-based /programs URL
// stays reachable via the "browse all with filters" link.
export async function PresetView({ h1, intro, filters, fullFilterHref }: PresetViewProps) {
  const { rows, total } = await listPrograms({ ...filters, pageSize: 20 }).catch(() => ({ rows: [], total: 0 }));

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10 md:py-14">
      <header className="mb-10">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Preset</p>
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-neutral-50 leading-tight">{h1}</h1>
        <p className="mt-4 text-neutral-400 max-w-2xl leading-relaxed">{intro}</p>
        <div className="mt-6 mono text-xs text-neutral-500 inline-flex items-center gap-3">
          <span className="tabular-nums text-neutral-100">{total.toLocaleString()}</span>
          <span>matching programs</span>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="mono text-xs text-neutral-500">— no programs match this preset yet —</p>
      ) : (
        <>
          <div className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-900 bg-neutral-950/60">
                  <th className="text-left px-5 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal">Program</th>
                  <th className="hidden md:table-cell text-left px-5 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal w-40">Platform</th>
                  <th className="text-right px-5 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal w-28">Reward</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="group border-b border-neutral-900 last:border-b-0 hover:bg-neutral-900/40 transition">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/programs/${p.platform}/${p.slug}`}
                        className="text-neutral-100 group-hover:text-emerald-400 transition font-medium"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="hidden md:table-cell px-5 py-3.5">
                      <span className="inline-flex items-center gap-2 mono text-xs text-neutral-400">
                        <PlatformLogo platform={p.platform} size="sm" />
                        {platformLabel(p.platform)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right mono text-sm tabular-nums">
                      <span className={p.maxBounty ? 'text-emerald-300' : 'text-neutral-600'}>
                        {formatBounty(p.maxBounty, p.currency ?? 'USD')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex items-center justify-between mono text-xs">
            <span className="text-neutral-500">
              showing {rows.length} of {total.toLocaleString()}
            </span>
            <Link
              href={fullFilterHref}
              className="cta-arrow text-emerald-400 hover:text-emerald-300 transition inline-flex items-center gap-1.5"
            >
              browse all with filters <span className="arrow">→</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
