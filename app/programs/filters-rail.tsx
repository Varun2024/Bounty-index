'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { ProgramFilters } from '@/lib/db/queries';
import { SearchIcon, FilterIcon } from '@/app/_ui/icons';
import { SavedFiltersSection } from './saved-filters-section';

interface FiltersRailProps {
  platforms: string[];
  assetTypes: string[];
  filters: ProgramFilters;
}

export function FiltersRail({ platforms, assetTypes, filters }: FiltersRailProps) {
  const router = useRouter();
  const sp = useSearchParams();

  const update = useCallback(
    (patch: Record<string, string | string[] | null>) => {
      const next = new URLSearchParams(sp?.toString() ?? '');
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) next.delete(k);
        else next.set(k, Array.isArray(v) ? v.join(',') : v);
      }
      next.delete('page');
      router.push(`/programs?${next.toString()}`);
    },
    [router, sp],
  );

  const togglePlatform = (p: string) => {
    const current = new Set(filters.platform ?? []);
    if (current.has(p)) current.delete(p);
    else current.add(p);
    update({ platform: [...current] });
  };

  const toggleAsset = (a: string) => {
    const current = new Set(filters.assetType ?? []);
    if (current.has(a)) current.delete(a);
    else current.add(a);
    update({ assetType: [...current] });
  };

  return (
    <aside className="md:sticky md:top-20 self-start space-y-6 text-sm">
      <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest text-neutral-500 pb-3 border-b border-neutral-900">
        <FilterIcon size={12} />
        Filters
      </div>
      <div className="relative">
        <SearchIcon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
        <input
          type="search"
          placeholder="program or scope…"
          defaultValue={filters.q ?? ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') update({ q: e.currentTarget.value });
          }}
          className="focus-ring w-full mono text-xs pl-8 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded focus:outline-none focus:border-emerald-400/50"
        />
        <p className="mono text-[10px] text-neutral-600 mt-1.5">
          <span className="text-neutral-700">{'// '}</span>
          matches program name OR any in-scope identifier
        </p>
      </div>

      <SavedFiltersSection />

      <FilterGroup label="Platform">
        {platforms.map((p) => (
          <Chip key={p} active={filters.platform?.includes(p) ?? false} onClick={() => togglePlatform(p)}>
            {p}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Asset type">
        {assetTypes.map((a) => (
          <Chip key={a} active={filters.assetType?.includes(a) ?? false} onClick={() => toggleAsset(a)}>
            {a}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Min reward ($)">
        {[0, 500, 1000, 5000, 10000].map((v) => (
          <Chip
            key={v}
            active={(filters.minReward ?? 0) === v}
            onClick={() => update({ minReward: v === 0 ? null : String(v) })}
          >
            {v === 0 ? 'any' : `$${v >= 1000 ? `${v / 1000}k` : v}+`}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Program">
        {(['all', 'bounty', 'vdp'] as const).map((t) => (
          <Chip key={t} active={(filters.programType ?? 'all') === t} onClick={() => update({ programType: t })}>
            {t}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Safety">
        <Chip
          active={filters.safeHarbor ?? false}
          onClick={() => update({ safeHarbor: filters.safeHarbor ? null : '1' })}
        >
          safe harbor
        </Chip>
        <p className="mono text-[10px] leading-relaxed text-neutral-600 mt-1 w-full">
          <span className="text-neutral-700">{'// '}</span>
          coverage: Bugcrowd only. other platforms don&apos;t publish this structurally yet.
        </p>
      </FilterGroup>

      <FilterGroup label="Sort">
        {(['newest', 'reward', 'name'] as const).map((s) => (
          <Chip key={s} active={(filters.sort ?? 'newest') === s} onClick={() => update({ sort: s })}>
            {s}
          </Chip>
        ))}
      </FilterGroup>
    </aside>
  );
}

interface FilterGroupProps {
  label: string;
  children: React.ReactNode;
}

function FilterGroup({ label, children }: FilterGroupProps) {
  return (
    <div>
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}

function Chip({ active, onClick, children, title }: ChipProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`chip-pop focus-ring mono text-[11px] px-2 py-1 rounded border ${
        active
          ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
          : 'border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  );
}
