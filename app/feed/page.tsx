import Link from 'next/link';
import { newestPrograms } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META } from '@/lib/format';
import { RssIcon } from '@/app/_ui/icons';

export const dynamic = 'force-dynamic';

function isoDate(d: Date | null): string {
  if (!d) return '—';
  return new Date(d).toISOString().slice(0, 10);
}

export default async function FeedPage() {
  let rows: Awaited<ReturnType<typeof newestPrograms>> = [];
  let dbError: string | null = null;
  try {
    rows = await newestPrograms(80);
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'DB error';
  }

  // Group by date
  const groups = new Map<string, typeof rows>();
  for (const p of rows) {
    const date = isoDate(p.firstSeenAt);
    const list = groups.get(date) ?? [];
    list.push(p);
    groups.set(date, list);
  }

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10">
      <div className="flex items-end justify-between border-b border-neutral-900 pb-6 reveal">
        <div>
          <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Log</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">New programs</h1>
          <p className="text-neutral-400 mt-2">The freshest programs added to the index.</p>
        </div>
        <a
          href="/feed.xml"
          className="focus-ring mono text-xs px-3 py-1.5 border border-neutral-800 rounded-md text-neutral-400 hover:text-emerald-400 hover:border-neutral-600 transition inline-flex items-center gap-2"
        >
          <RssIcon size={12} />
          RSS
        </a>
      </div>

      {dbError ? (
        <p className="mono text-xs text-amber-400 mt-8">DB_NOT_CONNECTED</p>
      ) : rows.length === 0 ? (
        <p className="mono text-xs text-neutral-500 mt-8">— empty log — run <code className="text-emerald-400">npm run ingest</code></p>
      ) : (
        <div className="mt-10 space-y-10">
          {[...groups.entries()].map(([date, entries]) => (
            <section key={date} className="md:grid md:grid-cols-[92px_1fr] md:gap-6">
              <div className="mb-3 md:mb-0 md:pt-1 flex md:block items-baseline gap-3">
                <p className="mono text-xs text-neutral-500 tabular-nums">{date}</p>
                <p className="mono text-[10px] uppercase tracking-widest text-neutral-700 md:mt-1">{entries.length} added</p>
              </div>
              <ul>
                {entries.map((p, i) => (
                  <li
                    key={p.id}
                    className={`${i === entries.length - 1 ? '' : 'border-b border-neutral-900'} group`}
                  >
                    <Link
                      href={`/programs/${p.platform}/${p.slug}`}
                      className="flex items-center gap-3 py-3.5 md:py-3 hover:bg-neutral-900/40 active:bg-neutral-900/60 -mx-3 px-3 rounded transition"
                    >
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-neutral-100 group-hover:text-emerald-400 transition truncate">{p.name}</p>
                        <p className="mono text-[11px] text-neutral-500 mt-0.5">{platformLabel(p.platform)}</p>
                      </div>
                      <span className="mono text-[10px] uppercase tracking-widest text-emerald-300 bg-emerald-400/[0.06] border border-emerald-400/25 px-2 py-1 rounded shrink-0">
                        new
                      </span>
                      <span className="mono text-sm text-neutral-100 tabular-nums shrink-0 w-14 md:w-16 text-right">
                        {formatBounty(p.maxBounty, p.currency ?? 'USD')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
