import Link from 'next/link';
import { listPrograms, type ProgramFilters } from '@/lib/db/queries';
import { FiltersRail } from './filters-rail';
import { Pagination } from './pagination';
import { KeyboardNav } from './keyboard-nav';
import { ActiveFilters } from './active-filters';
import { FilterDrawer } from './filter-drawer';
import { KeyboardHintBanner } from './keyboard-hint-banner';
import { formatBounty, platformLabel, PLATFORM_META } from '@/lib/format';
import { opportunityScore } from '@/lib/opportunity';
import { AGGREGATE_MIN_N } from '@/lib/disclosed';
import { EmptyState } from '@/app/_ui/empty-state';

export const dynamic = 'force-dynamic';

const PLATFORMS = ['hackerone', 'bugcrowd', 'intigriti', 'yeswehack', 'federacy', 'immunefi', 'hackenproof'];
const ASSET_TYPES = ['url', 'wildcard', 'api', 'android', 'ios', 'source_code', 'hardware', 'smart_contract'];

function parseArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : v.split(',').filter(Boolean);
}

// Sanitize numeric query params at the trust boundary. `?minReward=abc` / `?page=1e999` would
// otherwise become NaN/Infinity, reach the SQL (OFFSET / `maxBounty >= $`), and throw — noise in
// the logs and, before the breaker was hardened, a push toward DB-degraded mode.
function finitePos(v: string | string[] | undefined): number | undefined {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
function finitePage(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function countActive(f: ProgramFilters): number {
  let n = 0;
  if (f.q) n++;
  n += f.platform?.length ?? 0;
  n += f.assetType?.length ?? 0;
  if (f.programType && f.programType !== 'all') n++;
  if (f.minReward) n++;
  if (f.hasBounty) n++;
  if (f.safeHarbor) n++;
  if (f.hasDisclosed) n++;
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
    safeHarbor: sp.safeHarbor === '1',
    hasDisclosed: sp.hasDisclosed === '1',
    minReward: finitePos(sp.minReward),
    sort: (sp.sort as ProgramFilters['sort']) ?? 'reward',
    page: finitePage(sp.page),
    pageSize: 30,
    withDisclosed: true, // the list shows a real-payout line per row; other callers skip the cost
  };

  // Build export query string from the current filters (drop `page` — export returns everything).
  const exportQs = (() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === 'page' || v == null || v === '') continue;
      p.set(k, Array.isArray(v) ? v.join(',') : v);
    }
    return p.toString();
  })();

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
            <p className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">The index</p>
            <h1 className="text-3xl font-semibold text-neutral-100 tracking-tight">Programs</h1>
            <p className="mono text-[11px] text-neutral-400 mt-2 max-w-md hidden md:block">
              Open any program for <span className="text-neutral-400">copyable scope</span>,{' '}
              <span className="text-neutral-400">change history</span>,{' '}
              <span className="text-neutral-400">community response times</span>, and{' '}
              <span className="text-neutral-400">private notes</span>.
            </p>
          </div>
          <div className="text-right">
            <p className="mono text-xs text-neutral-400">
              {dbError ? 'DB not connected' : (
                <>
                  <span className="text-neutral-100 tabular-nums">{total.toLocaleString()}</span>
                  <span className="text-neutral-400"> results</span>
                </>
              )}
            </p>
            <p className="mono text-[10px] uppercase tracking-widest text-neutral-400 mt-1">
              sorted by {filters.sort}
            </p>
            {!dbError && total > 0 && (
              <p className="mono text-[10px] uppercase tracking-widest text-neutral-400 mt-2 flex items-center gap-2 justify-end">
                <span>export</span>
                <a
                  href={`/api/export/programs?format=csv${exportQs ? '&' + exportQs : ''}`}
                  className="text-emerald-400 hover:text-emerald-300 transition focus-ring rounded"
                  title="Download current filter set as CSV"
                >
                  csv
                </a>
                <span className="text-neutral-800">·</span>
                <a
                  href={`/api/export/programs?format=json${exportQs ? '&' + exportQs : ''}`}
                  className="text-emerald-400 hover:text-emerald-300 transition focus-ring rounded"
                  title="Download current filter set as JSON"
                >
                  json
                </a>
              </p>
            )}
          </div>
        </div>

        <KeyboardHintBanner />
        <ActiveFilters filters={filters} />

        {dbError ? (
          <div className="border border-amber-900/60 bg-amber-950/30 rounded-lg p-4 text-sm text-amber-200/80">
            <p className="mono text-xs text-amber-400 mb-2">DB_NOT_CONNECTED</p>
            <p>Set <code className="mono text-amber-300">DATABASE_URL</code> in <code className="mono">.env</code>, then run:</p>
            <pre className="mono text-xs mt-2 text-amber-200/60">npm run db:push && npm run ingest</pre>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="no programs match"
            action={{ href: '/programs', label: 'clear all filters' }}
            footnote={
              <span className="inline-flex items-center gap-2">
                or press <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-400">/</kbd> to refine the search
              </span>
            }
          >
            Nothing in the index fits this filter set. Loosen a filter, or clear them all to start over.
          </EmptyState>
        ) : (
          <div className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-neutral-900 bg-neutral-950/60">
                  <th className="text-left px-4 md:px-5 py-3 mono text-[10px] uppercase tracking-widest text-neutral-400 font-normal">Program</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 mono text-[10px] uppercase tracking-widest text-neutral-400 font-normal w-40">Platform</th>
                  <th className="hidden md:table-cell text-left px-4 py-3 mono text-[10px] uppercase tracking-widest text-neutral-400 font-normal w-24">Type</th>
                  <th className="hidden md:table-cell text-right px-4 py-3 mono text-[10px] uppercase tracking-widest text-neutral-400 font-normal w-20">
                    <Link href="/how-scored" className="hover:text-emerald-400 transition" title="Hunt score: how we sort the index, not expected payout. See /how-scored.">Hunt</Link>
                  </th>
                  <th className="text-right px-4 md:px-5 py-3 mono text-[10px] uppercase tracking-widest text-neutral-400 font-normal w-24 md:w-32">
                    <span title="Stated reward band (or max). A ceiling set by the program, not a typical payout.">Stated reward</span>
                  </th>
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
                        <p className="mono text-[11px] text-neutral-400 mt-0.5 md:hidden">
                          {platformLabel(p.platform)}
                          {p.offersBounty ? <span className="text-emerald-400/80"> · bounty</span> : <span className="text-neutral-400"> · vdp</span>}
                        </p>
                        {p.handle && p.handle !== p.slug ? (
                          <p className="mono text-[11px] text-neutral-400 mt-0.5 hidden md:block">@{p.handle}</p>
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
                            : 'text-neutral-400 border-neutral-800 bg-neutral-900/50'
                        }`}
                      >
                        {p.programType}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-4 mono text-sm text-right tabular-nums">
                      <OpportunityBadge program={p} />
                    </td>
                    <td className="px-4 md:px-5 py-4 mono text-sm text-right tabular-nums">
                      <span className={p.maxBounty ? 'text-neutral-100' : 'text-neutral-700'}>
                        {p.minBounty && p.maxBounty
                          ? `${formatBounty(p.minBounty, p.currency ?? 'USD')}–${formatBounty(p.maxBounty, p.currency ?? 'USD')}`
                          : formatBounty(p.maxBounty, p.currency ?? 'USD')}
                      </span>
                      {p.disclosedN >= AGGREGATE_MIN_N && p.disclosedMedian != null && (
                        <span
                          className="block text-[11px] text-emerald-300/80 mt-0.5"
                          title={`Median of ${p.disclosedN} disclosed payouts (USD) — what this program actually paid, not the stated ceiling`}
                        >
                          real ~{formatBounty(p.disclosedMedian)}
                        </span>
                      )}
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
          <p className="mt-6 mono text-[10px] uppercase tracking-widest text-neutral-400 flex items-center gap-4">
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

interface OpportunityBadgeProps {
  program: {
    maxBounty: number | null;
    offersBounty: boolean;
    lastUpdatedAt: Date | null;
  };
}

function OpportunityBadge({ program }: OpportunityBadgeProps) {
  const { total } = opportunityScore(program);
  const tone =
    total >= 75
      ? 'text-emerald-300'
      : total >= 50
        ? 'text-emerald-400/70'
        : total >= 25
          ? 'text-neutral-300'
          : 'text-neutral-400';
  const bar =
    total >= 75 ? 'bg-emerald-300' : total >= 50 ? 'bg-emerald-400/70' : total >= 25 ? 'bg-neutral-500' : 'bg-neutral-700';
  // Number plus a tiny gauge so the flagship score reads as a level, not a bare digit.
  return (
    <span className="inline-flex flex-col items-end gap-1" title={`Hunt score ${total}/100 · a sort signal, not expected payout · see /how-scored`}>
      <span className={tone}>{total}</span>
      <span className="block w-9 h-[3px] rounded-full bg-neutral-900 overflow-hidden">
        <span className={`block h-full rounded-full ${bar}`} style={{ width: `${total}%` }} />
      </span>
    </span>
  );
}
