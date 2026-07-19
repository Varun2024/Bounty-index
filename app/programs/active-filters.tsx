'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { ProgramFilters } from '@/lib/db/queries';
import { platformLabel } from '@/lib/format';

interface ActiveFiltersProps {
  filters: ProgramFilters;
}

export function ActiveFilters({ filters }: ActiveFiltersProps) {
  const router = useRouter();
  const sp = useSearchParams();

  const clearAll = useCallback(() => router.push('/programs'), [router]);

  const active = buildActive(filters);
  if (active.length === 0) return null;

  const clearOne = (key: string, value?: string) => {
    const next = new URLSearchParams(sp?.toString() ?? '');
    if (value && next.get(key)) {
      const list = next.get(key)!.split(',').filter((v) => v !== value);
      if (list.length) next.set(key, list.join(','));
      else next.delete(key);
    } else {
      next.delete(key);
    }
    next.delete('page');
    router.push(`/programs?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <span className="mono text-[10px] uppercase tracking-widest text-neutral-500 mr-1">
        {active.length} active
      </span>
      {active.map((a) => (
        <button
          key={a.key + ':' + (a.value ?? '')}
          onClick={() => clearOne(a.key, a.value)}
          className="chip-pop focus-ring mono text-[11px] px-2 py-1 rounded border border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300 hover:border-emerald-400/60 hover:bg-emerald-400/[0.12] inline-flex items-center gap-1.5"
        >
          <span className="text-emerald-500/70">{a.label}:</span>
          <span>{a.display}</span>
          <span className="text-emerald-400/60">×</span>
        </button>
      ))}
      <button
        onClick={clearAll}
        className="mono text-[11px] px-2 py-1 rounded text-neutral-500 hover:text-neutral-200 transition ml-1"
      >
        clear all
      </button>
    </div>
  );
}

interface ActiveChip {
  key: string;
  value?: string;
  label: string;
  display: string;
}

function buildActive(f: ProgramFilters): ActiveChip[] {
  const out: ActiveChip[] = [];
  if (f.q) out.push({ key: 'q', label: 'search', display: `"${f.q}"` });
  for (const p of f.platform ?? []) out.push({ key: 'platform', value: p, label: 'platform', display: platformLabel(p) });
  for (const a of f.assetType ?? []) out.push({ key: 'assetType', value: a, label: 'asset', display: a });
  if (f.programType && f.programType !== 'all') out.push({ key: 'programType', label: 'type', display: f.programType });
  if (f.minReward) out.push({ key: 'minReward', label: 'min', display: `$${f.minReward >= 1000 ? `${f.minReward / 1000}k` : f.minReward}+` });
  if (f.hasBounty) out.push({ key: 'hasBounty', label: 'has', display: 'bounty' });
  if (f.safeHarbor) out.push({ key: 'safeHarbor', label: 'safety', display: 'safe harbor' });
  return out;
}
