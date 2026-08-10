'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { useSavedFilters } from '@/lib/saved-filters';

// Builds a normalized query string of the *currently applied* filters, minus the pagination
// pointer. Empty = no filters worth saving.
function currentFilterQuery(sp: URLSearchParams): string {
  const next = new URLSearchParams(sp.toString());
  next.delete('page');
  // Strip empties.
  for (const [k, v] of [...next.entries()]) {
    if (!v) next.delete(k);
  }
  const str = next.toString();
  return str;
}

export function SavedFiltersSection() {
  const router = useRouter();
  const sp = useSearchParams();
  const { filters, hydrated, add, remove, isAuthed } = useSavedFilters();
  const current = currentFilterQuery(new URLSearchParams(sp?.toString() ?? ''));
  const hasActiveFilters = current.length > 0;

  const alreadySaved = filters.some((f) => f.query === current);

  const onSave = useCallback(async () => {
    if (!hasActiveFilters) return;
    const name = window.prompt('Name this filter set (up to 40 chars):', '');
    if (!name) return;
    await add(name, current);
  }, [add, current, hasActiveFilters]);

  // Server-render an empty shell to avoid hydration mismatch — content loads once hydrated.
  if (!hydrated) {
    return <div className="pt-2 pb-1" aria-hidden />;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-500">Saved filters</span>
        {filters.length > 0 && (
          <span className="mono text-[10px] uppercase tracking-widest text-neutral-700 tabular-nums">
            {filters.length.toString().padStart(2, '0')}
          </span>
        )}
      </div>

      {filters.length === 0 ? (
        <p className="mono text-[10px] leading-relaxed text-neutral-600">
          <span className="text-neutral-700">{'// '}</span>
          save the <span className="text-neutral-400">current filter combo</span> to jump back to it later.
          {!isAuthed && (
            <>
              {' '}
              signed-out saves stay <span className="text-neutral-400">on this device</span>.
            </>
          )}
        </p>
      ) : (
        <ul className="space-y-1">
          {filters.map((f) => {
            const isCurrent = f.query === current;
            return (
              <li key={f.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => router.push(`/programs${f.query ? `?${f.query}` : ''}`)}
                  className={`focus-ring mono text-[11px] px-2 py-1.5 flex-1 min-w-0 text-left rounded border truncate transition ${
                    isCurrent
                      ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-300'
                      : 'border-neutral-900 text-neutral-300 hover:border-neutral-700 hover:text-neutral-100 hover:bg-neutral-900/50'
                  }`}
                  title={f.query || 'no filters'}
                >
                  {f.name}
                </button>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  aria-label={`Delete saved filter ${f.name}`}
                  title="delete"
                  className="focus-ring mono text-[11px] px-2 py-1.5 rounded border border-transparent text-neutral-700 hover:text-amber-300 hover:border-neutral-800 transition"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasActiveFilters && !alreadySaved && (
        <button
          type="button"
          onClick={onSave}
          className="focus-ring mono text-[11px] w-full px-2 py-1.5 border border-dashed border-neutral-800 text-neutral-500 hover:text-emerald-300 hover:border-emerald-400/40 rounded transition"
        >
          + save current filter
        </button>
      )}
    </div>
  );
}
