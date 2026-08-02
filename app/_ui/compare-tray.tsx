'use client';

import Link from 'next/link';
import { useCompareSelection } from '@/lib/compare';

export function CompareTray() {
  const { ids, hydrated, clear, max } = useCompareSelection();
  if (!hydrated || ids.length === 0) return null;

  const href = `/compare?ids=${ids.join(',')}`;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-emerald-400/40 bg-neutral-950/90 backdrop-blur-md pl-4 pr-1 py-1 shadow-[0_10px_40px_-10px_rgba(52,211,153,0.5)]">
      <span className="mono text-xs text-emerald-300 tabular-nums">
        {ids.length}
        <span className="text-neutral-600">/{max}</span>
      </span>
      <span className="mono text-[10px] uppercase tracking-widest text-neutral-500">to compare</span>
      <Link
        href={href}
        className="mono text-xs px-3 py-1.5 rounded-full bg-emerald-400 text-neutral-950 hover:bg-emerald-300 transition ml-1"
      >
        compare →
      </Link>
      <button
        onClick={clear}
        title="Clear selection"
        aria-label="Clear selection"
        className="mono text-neutral-500 hover:text-neutral-200 text-sm w-7 h-7 rounded-full hover:bg-neutral-900 transition"
      >
        ×
      </button>
    </div>
  );
}
