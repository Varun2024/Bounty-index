'use client';

import { useWatchlist } from '@/lib/watchlist';

export function UnwatchButton({ programId }: { programId: number }) {
  const { remove } = useWatchlist();
  return (
    <button
      onClick={() => remove(programId)}
      aria-label="Stop watching this program"
      title="Unwatch"
      className="mono text-neutral-600 hover:text-neutral-200 text-sm w-7 h-7 shrink-0 rounded hover:bg-neutral-900 transition"
    >
      ×
    </button>
  );
}
