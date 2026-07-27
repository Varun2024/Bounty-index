import Link from 'next/link';
import { listPrograms, type ProgramFilters } from '@/lib/db/queries';
import { FiltersRail } from './filters-rail';
import { Pagination } from './pagination';
import { KeyboardNav } from './keyboard-nav';
import { ActiveFilters } from './active-filters';
import { FilterDrawer } from './filter-drawer';
import { formatBounty, platformLabel, PLATFORM_META } from '@/lib/format';

export const dynamic = 'force-dynamic';

const PLATFORMS = ['hackerone', 'bugcrowd', 'intigriti', 'yeswehack', 'federacy'];
const ASSET_TYPES = ['url', 'wildcard', 'api', 'android', 'ios', 'source_code', 'hardware', 'smart_contract'];

function parseArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : v.split(',').filter(Boolean);
}

function countActive(f: ProgramFilters): number {
  let n = 0;
  if (f.q) n++;
  n += f.platform?.length ?? 0;
  n += f.assetType?.length ?? 0;
  if (f.programType && f.programType !== 'all') n++;
  if (f.minReward) n++;
  if (f.hasBounty) n++;
  return n;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProgramsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const filters: ProgramFilters = {
    q: typeof sp.q === 'string' ? sp.q : undefined,
    platform: parseArray(sp.platform),
    assetType: parseArray(sp.assetType),
    programType: typeof sp.programType === 'string' ? sp.programType : 'all',
    hasBounty: sp.hasBounty === '1',
    minReward: sp.minReward ? Number(sp.minReward) : undefined,
    sort: (sp.sort as ProgramFilters['sort']) ?? 'reward',
    page: sp.page ? Number(sp.page) : 1,
    pageSize: 30,
  };

  let rows: Awaited<ReturnType<typeof listPrograms>>['rows'] = [];
  let total = 0;
  let dbError: string | null = null;
  try {
    const result = await listPrograms(filters);
    rows = result.rows;
    total = result.total;
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'DB error';
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-10 grid grid-cols-1 md:grid-cols-[248px_1fr] gap-6 md:gap-10">
      <FilterDrawer activeCount={countActive(filters)}>
        <FiltersRail platforms={PLATFORMS} assetTypes={ASSET_TYPES} filters={filters} />
      </FilterDrawer>
      <section>
        <div className="flex items-end justify-between mb-8 reveal">
          <div>
            <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">The index</p>
            <h1 className="text-3xl font-semibold text-neutral-100 tracking-tight">Programs</h1>
          </div>
          <div className="text-right">
            <p className="mono text-xs text-neutral-500">
              {dbError ? 'DB not connected' : (
                <>
                  <span className="text-neutral-100 tabular-nums">{total.toLocaleString()}</span>
                  <span className="text-neutral-500"> results</span>
                </>
              )}
            </p>
            <p className="mono text-[10px] uppercase tracking-widest text-neutral-600 mt-1">
              sorted by {filters.sort}
            </p>
          </div>
        </div>

        <ActiveFilters filters={filters} />

        {dbError ? (
          <div className="border border-amber-900/60 bg-amber-950/30 rounded-lg p-4 text-sm text-amber-200/80">
            <p className="mono text-xs text-amber-400 mb-2">DB_NOT_CONNECTED</p>
            <p>Set <code className="mono text-amber-300">DATABASE_URL</code> in <code className="mono">.env</code>, then run:</p>
            <pre className="mono text-xs mt-2 text-amber-200/60">npm run db:push && npm run ingest</pre>
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-neutral-900 rounded-lg p-16 text-center bg-neutral-950/40">
            <p className="mono text-xs text-neutral-500 uppercase tracking-widest">— no programs match —</p>
            <p className="text-neutral-400 mt-3">try broadening filters or clearing search</p>
            <p className="mt-6 mono text-[10px] uppercase tracking-widest text-neutral-600">
              <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-400">/</kbd>
              <span className="ml-2">to focus search</span>
            </p>
          </div>
        ) : (
          <div className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-neutral-900 bg-neutral-950/60">
                  <th className="text-left px-4 md:px-5 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal">Program</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal w-40">Platform</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal w-24">Type</th>
                  <th className="text-right px-4 md:px-5 py-3 mono text-[10px] uppercase tracking-widest text-neutral-500 font-normal w-24 md:w-32">Reward</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr
                    key={p.id}
                    data-row-href={`/programs/${p.platform}/${p.slug}`}
                    className="group border-b border-neutral-900 last:border-b-0 hover:bg-neutral-900/50 active:bg-neutral-900/60 data-[active=1]:bg-emerald-950/25 data-[active=1]:outline data-[active=1]:outline-1 data-[active=1]:-outline-offset-1 data-[active=1]:outline-emerald-400/40 transition relative"
                  >
                    <td className="px-4 md:px-5 py-4 relative">
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400 opacity-0 group-hover:opacity-100 transition" />
                      <Link href={`/programs/${p.platform}/${p.slug}`} className="block">
                        <div className="flex items-center gap-2">
                          <span className={`md:hidden shrink-0 w-1.5 h-1.5 rounded-full ${PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500'}`} />
                          <p className="text-neutral-100 group-hover:text-emerald-400 transition font-medium truncate">{p.name}</p>
                        </div>
                        <p className="mono text-[11px] text-neutral-500 mt-0.5 md:hidden">
                          {platformLabel(p.platform)}
                          {p.offersBounty ? <span className="text-emerald-400/80"> · bounty</span> : <span className="text-neutral-600"> · vdp</span>}
                        </p>
                        {p.handle && p.handle !== p.slug ? (
                          <p className="mono text-[11px] text-neutral-500 mt-0.5 hidden md:block">@{p.handle}</p>
                        ) : null}
                      </Link>
                    </td>
                    <td className="hidden md:table-cell px-4 py-4">
                      <div className="inline-flex items-center gap-2 mono text-xs text-neutral-400">
                        <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500'}`} />
                        {platformLabel(p.platform)}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-4">
                      <span
                        className={`mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${
                          p.offersBounty
                            ? 'text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.06]'
                            : 'text-neutral-500 border-neutral-800 bg-neutral-900/50'
                        }`}
                      >
                        {p.programType}
                      </span>
                    </td>
                    <td className="px-4 md:px-5 py-4 mono text-sm text-right tabular-nums">
                      <span className={p.maxBounty ? 'text-neutral-100' : 'text-neutral-700'}>
                        {formatBounty(p.maxBounty, p.currency ?? 'USD')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!dbError && total > (filters.pageSize ?? 30) && (
          <Pagination page={filters.page ?? 1} pageSize={filters.pageSize ?? 30} total={total} sp={sp} />
        )}

        {!dbError && rows.length > 0 && (
          <p className="mt-6 mono text-[10px] uppercase tracking-widest text-neutral-600 flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-400">/</kbd>
              search
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-400">j</kbd>
              <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-400">k</kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-400">↵</kbd>
              open
            </span>
          </p>
        )}
      </section>
      <KeyboardNav />
    </div>
  );
}
