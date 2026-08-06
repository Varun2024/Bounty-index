'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useWatchlist } from '@/lib/watchlist';

// Bridges localStorage → URL. If localStorage has IDs and the URL doesn't (or they differ),
// replace the URL so the server can render with the right set. The reverse (URL has IDs,
// localStorage is empty) is left alone — that's a shared link case that we don't support yet.
export function WatchlistSync() {
  const { ids, hydrated } = useWatchlist();
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    if (!hydrated) return;
    const current = sp?.get('ids') ?? '';
    const wanted = ids.join(',');
    if (current === wanted) return;
    router.replace(wanted ? `/watchlist?ids=${wanted}` : '/watchlist');
  }, [ids, hydrated, router, sp]);

  return null;
}
