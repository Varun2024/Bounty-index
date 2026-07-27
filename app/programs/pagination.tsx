import Link from 'next/link';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  sp: Record<string, string | string[] | undefined>;
}

function hrefWithPage(sp: Record<string, string | string[] | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'page' || v === undefined) continue;
    params.set(k, Array.isArray(v) ? v.join(',') : v);
  }
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/programs?${qs}` : '/programs';
}

export function Pagination({ page, pageSize, total, sp }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="mt-6 flex items-center justify-between mono text-xs text-neutral-500">
      <span>
        page {page} / {totalPages}
      </span>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link
            href={hrefWithPage(sp, page - 1)}
            className="px-3 py-1.5 border border-neutral-800 rounded hover:border-neutral-600 hover:text-neutral-200 transition"
          >
            ← prev
          </Link>
        ) : (
          <span className="px-3 py-1.5 border border-neutral-900 rounded text-neutral-700">← prev</span>
        )}
        {hasNext ? (
          <Link
            href={hrefWithPage(sp, page + 1)}
            className="px-3 py-1.5 border border-neutral-800 rounded hover:border-neutral-600 hover:text-neutral-200 transition"
          >
            next →
          </Link>
        ) : (
          <span className="px-3 py-1.5 border border-neutral-900 rounded text-neutral-700">next →</span>
        )}
      </div>
    </nav>
  );
}
