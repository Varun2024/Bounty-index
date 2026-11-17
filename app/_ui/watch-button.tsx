'use client';

import { useWatchlist } from '@/lib/watchlist';

interface WatchButtonProps {
  programId: number;
}

export function WatchButton({ programId }: WatchButtonProps) {
  const { ids, hydrated, toggle } = useWatchlist();
  const active = ids.includes(programId);

  return (
    <button
      onClick={() => toggle(programId)}
      disabled={!hydrated}
      title={active ? 'Stop watching, you can always come back' : 'Watch: we snapshot daily and tell you what changed. No email, promise.'}
      aria-pressed={active}
      className={`focus-ring mono text-xs px-3 py-2.5 rounded-md border transition inline-flex items-center gap-2 ${
        active
          ? 'border-amber-400/50 bg-amber-400/[0.10] text-amber-300 hover:bg-amber-400/[0.16]'
          : 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-emerald-400/60 hover:text-emerald-300 hover:bg-neutral-800 disabled:opacity-40'
      }`}
    >
      <span aria-hidden>{active ? '★' : '☆'}</span>
      {active ? 'watching' : 'watch'}
    </button>
  );
}
