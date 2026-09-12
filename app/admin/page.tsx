import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { desc, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { db } from '@/lib/db/client';
import {
  users,
  userWatchlist,
  userCompare,
  userNotes,
  userReports,
  userSavedFilters,
  discordWebhooks,
  programs,
  programSnapshots,
} from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin · Bounty Index',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await auth();
  if (!isAdmin(session)) notFound();

  // Every metric is a single count query — the whole page is O(metrics), not O(rows).
  // allSettled so one dead query (Neon quota, cold-start) doesn't 500 the whole page.
  // Failed metrics render as "—" instead of crashing.
  const settle = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
  const [
    totalUsers,
    totalWatchlist,
    totalCompare,
    totalNotes,
    totalReports,
    totalSavedFilters,
    totalWebhooks,
    brokenWebhooks,
    totalPrograms,
    totalSnapshots,
    recentUsers,
    topWatchedRows,
  ] = await Promise.all([
    settle(db.$count(users)),
    settle(db.$count(userWatchlist)),
    settle(db.$count(userCompare)),
    settle(db.$count(userNotes)),
    settle(db.$count(userReports)),
    settle(db.$count(userSavedFilters)),
    settle(db.$count(discordWebhooks)),
    settle(db.$count(discordWebhooks, sql`${discordWebhooks.brokenAt} IS NOT NULL`)),
    settle(db.$count(programs)),
    settle(db.$count(programSnapshots)),
    settle(
      db
        .select({ id: users.id, name: users.name, email: users.email, image: users.image })
        .from(users)
        .orderBy(desc(users.id))
        .limit(20),
    ),
    settle(
      db
        .select({
          programId: userWatchlist.programId,
          n: sql<number>`count(*)::int`.as('n'),
        })
        .from(userWatchlist)
        .groupBy(userWatchlist.programId)
        .orderBy(sql`count(*) DESC`)
        .limit(10),
    ),
  ]);

  // Enrich the top-watched list with program names.
  const topWatched = topWatchedRows && topWatchedRows.length
    ? await (async () => {
        const ids = topWatchedRows.map((r) => r.programId);
        const rows = await db
          .select({ id: programs.id, name: programs.name, platform: programs.platform, slug: programs.slug })
          .from(programs)
          .where(sql`${programs.id} = ANY(${ids})`)
          .catch(() => [] as Array<{ id: number; name: string; platform: string; slug: string }>);
        const byId = new Map(rows.map((r) => [r.id, r]));
        return topWatchedRows
          .map((w) => ({ n: w.n, program: byId.get(w.programId) }))
          .filter((r) => r.program);
      })()
    : [];

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10 space-y-10">
      <header className="border-b border-neutral-900 pb-6">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Internal · noindex</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Admin</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Everything here is a live query — no caching. Refresh to re-run.
        </p>
      </header>

      <section>
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Signed-in users</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Total users" value={totalUsers} />
          <Tile label="Watchlist entries" value={totalWatchlist} />
          <Tile label="Compare entries" value={totalCompare} />
          <Tile label="Saved filters" value={totalSavedFilters} />
          <Tile label="Notes" value={totalNotes} />
          <Tile label="Community reports" value={totalReports} />
          <Tile label="Discord webhooks" value={totalWebhooks} />
          <Tile label="Broken webhooks" value={brokenWebhooks} tone={brokenWebhooks && brokenWebhooks > 0 ? 'warn' : undefined} />
        </div>
      </section>

      <section>
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Index</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Programs indexed" value={totalPrograms} />
          <Tile label="Snapshots stored" value={totalSnapshots} />
        </div>
      </section>

      <section>
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Recent sign-ups <span className="text-neutral-700">· latest 20</span></h2>
        {!recentUsers ? (
          <p className="mono text-xs text-neutral-600">— unavailable (DB degraded) —</p>
        ) : recentUsers.length === 0 ? (
          <p className="mono text-xs text-neutral-500">— no users yet —</p>
        ) : (
          <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40 divide-y divide-neutral-900">
            {recentUsers.map((u) => (
              <li key={u.id} className="px-4 py-3 flex items-center gap-3">
                {u.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.image} alt="" width={24} height={24} className="w-6 h-6 rounded-full border border-neutral-800" />
                ) : (
                  <span className="w-6 h-6 rounded-full border border-neutral-800 flex items-center justify-center mono text-[10px] text-neutral-500">
                    {(u.name ?? u.email ?? '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-100 truncate">{u.name ?? u.email ?? '(no name)'}</p>
                  {u.email && u.name ? <p className="mono text-[11px] text-neutral-500 truncate">{u.email}</p> : null}
                </div>
                <p className="mono text-[10px] text-neutral-600 truncate max-w-[240px]">{u.id}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Most-watched programs <span className="text-neutral-700">· top 10</span></h2>
        {topWatched.length === 0 ? (
          <p className="mono text-xs text-neutral-500">— nobody's watching anything yet —</p>
        ) : (
          <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40 divide-y divide-neutral-900">
            {topWatched.map((w) => (
              <li key={w.program!.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className="mono text-sm text-emerald-300 tabular-nums w-8 text-right">{w.n}</span>
                <a
                  href={`/programs/${w.program!.platform}/${w.program!.slug}`}
                  className="text-sm text-neutral-200 hover:text-emerald-400 truncate"
                >
                  {w.program!.name}
                </a>
                <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 ml-auto">{w.program!.platform}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface TileProps {
  label: string;
  value: number | null;
  tone?: 'warn';
}

function Tile({ label, value, tone }: TileProps) {
  const unavailable = value === null;
  const color = unavailable
    ? 'text-neutral-600'
    : tone === 'warn' && value > 0
    ? 'text-amber-300'
    : 'text-neutral-100';
  return (
    <div className="border border-neutral-900 rounded-lg p-4 bg-neutral-950/40">
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
        {unavailable ? '—' : value.toLocaleString()}
      </p>
    </div>
  );
}
