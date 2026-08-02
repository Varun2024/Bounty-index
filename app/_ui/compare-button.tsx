'use client';

import { useCompareSelection } from '@/lib/compare';

interface CompareButtonProps {
  programId: number;
}

export function CompareButton({ programId }: CompareButtonProps) {
  const { ids, hydrated, toggle, isFull } = useCompareSelection();
  const active = ids.includes(programId);
  // ponytail: render a placeholder pre-hydration so SSR & first-paint don't jitter the header layout.
  const disabled = !hydrated || (isFull && !active);

  return (
    <button
      onClick={() => toggle(programId)}
      disabled={disabled && hydrated}
      title={
        active
          ? 'Remove from comparison'
          : isFull
            ? 'Comparison is full (max 4)'
            : 'Add to comparison'
      }
      className={`focus-ring mono text-xs px-3 py-2.5 rounded-md border transition inline-flex items-center gap-2 ${
        active
          ? 'border-emerald-400/60 bg-emerald-400/[0.12] text-emerald-300 hover:bg-emerald-400/[0.18]'
          : 'border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed'
      }`}
    >
      <span aria-hidden>{active ? '✓' : '+'}</span>
      {active ? 'in compare' : 'compare'}
    </button>
  );
}
