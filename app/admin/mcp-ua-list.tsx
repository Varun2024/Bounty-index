'use client';

import { useState } from 'react';

interface McpUa {
  ua: string | null;
  clients: number;
  requests: number;
}

const PER_PAGE = 10;

// Paginated MCP user-agent breakdown for the admin page. The server fetches up to the top 100 UAs;
// this steps through them 10 at a time so the whole list is reachable without a wall of rows.
export function McpUaList({ items }: { items: McpUa[] }) {
  const [page, setPage] = useState(0);
  if (items.length === 0) return null;

  const pages = Math.ceil(items.length / PER_PAGE);
  const start = page * PER_PAGE;
  const slice = items.slice(start, start + PER_PAGE);

  return (
    <div className="mt-3">
      <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40 divide-y divide-neutral-900">
        {slice.map((u, i) => (
          <li key={start + i} className="px-4 py-2.5 flex items-center gap-3">
            <span className="mono text-[10px] text-neutral-600 tabular-nums w-5 text-right">{start + i + 1}</span>
            <span className="mono text-sm text-emerald-300 tabular-nums w-8 text-right">{u.clients}</span>
            <span className="text-sm text-neutral-200 truncate" title={u.ua ?? ''}>
              {u.ua ?? '(no user-agent)'}
            </span>
            <span className="mono text-[10px] uppercase tracking-widest text-neutral-400 ml-auto whitespace-nowrap">
              {u.requests.toLocaleString()} req
            </span>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="mt-2 flex items-center justify-between mono text-[10px] text-neutral-400">
          <span className="tabular-nums">
            showing {start + 1}&ndash;{Math.min(start + PER_PAGE, items.length)} of {items.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded border border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition focus-ring"
            >
              prev
            </button>
            <span className="tabular-nums">{page + 1}/{pages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page >= pages - 1}
              className="px-2 py-1 rounded border border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition focus-ring"
            >
              next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
