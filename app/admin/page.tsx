import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { desc, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { db } from '@/lib/db/client';
import { users, userWatchlist, programs } from '@/lib/db/schema';
import { listPendingSignups } from '@/lib/signup-queue';
import { McpUaList } from './mcp-ua-list';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin · Bounty Index',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await auth();
  if (!isAdmin(session)) notFound();

  // One round-trip for every count (neon-http = 1 HTTPS request per query).
  // allSettled-style: a dead counts query renders tiles as "—" instead of 500ing the page.
  const settle = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
  type Counts = {
    total_users: number; total_watchlist: number; total_compare: number;
    total_notes: number; total_reports: number; total_saved_filters: number;
    total_webhooks: number; broken_webhooks: number;
    total_programs: number; total_snapshots: number;
  };
  type McpCounts = {
    mcp_requests: number; mcp_clients: number;
    mcp_requests_7d: number; mcp_clients_7d: number;
  };
  type McpUa = { ua: string | null; clients: number; requests: number };
  type DayCount = { day: string; n: number };
  // MCP counts are a SEPARATE settled query on purpose: mcp_hits is a newer table and a
  // deploy can land before its migration runs. Folding it into the main counts query would
  // make one missing table blank every tile (it did — see 003_mcp_hits). Isolated, a missing
  // mcp_hits only blanks the MCP tiles.
  // Zero-filled daily series (last 30 days). generate_series supplies every day so a gap renders
  // as an empty slot — which is the point: a missing snapshots bar means the ingest cron didn't run.
  const dailySeries = (table: 'mcp_hits' | 'program_snapshots', tsCol: 'ts' | 'captured_at') =>
    settle(db.execute<DayCount>(sql`
      SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(c.n, 0)::int AS n
      FROM generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') d
      LEFT JOIN (
        SELECT ${sql.raw(tsCol)}::date AS day, count(*)::int AS n
        FROM ${sql.raw(table)}
        WHERE ${sql.raw(tsCol)} > now() - interval '30 days'
        GROUP BY 1
      ) c ON c.day = d::date
      ORDER BY day
    `));

  const [countsRows, recentUsers, topWatchedRows, mcpCountsRows, mcpUaRows, mcpDailyRows, snapDailyRows] = await Promise.all([
    settle(db.execute<Counts>(sql`
      SELECT
        (SELECT count(*) FROM "user")::int               AS total_users,
        (SELECT count(*) FROM user_watchlist)::int       AS total_watchlist,
        (SELECT count(*) FROM user_compare)::int         AS total_compare,
        (SELECT count(*) FROM user_notes)::int           AS total_notes,
        (SELECT count(*) FROM user_reports)::int         AS total_reports,
        (SELECT count(*) FROM user_saved_filters)::int   AS total_saved_filters,
        (SELECT count(*) FROM discord_webhooks)::int     AS total_webhooks,
        (SELECT count(*) FROM discord_webhooks WHERE broken_at IS NOT NULL)::int AS broken_webhooks,
        (SELECT count(*) FROM programs)::int             AS total_programs,
        (SELECT count(*) FROM program_snapshots)::int    AS total_snapshots
    `)),
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
    settle(db.execute<McpCounts>(sql`
      SELECT
        (SELECT count(*) FROM mcp_hits)::int                                  AS mcp_requests,
        (SELECT count(DISTINCT ip) FROM mcp_hits)::int                        AS mcp_clients,
        (SELECT count(*) FROM mcp_hits WHERE ts > now() - interval '7 days')::int           AS mcp_requests_7d,
        (SELECT count(DISTINCT ip) FROM mcp_hits WHERE ts > now() - interval '7 days')::int AS mcp_clients_7d
    `)),
    settle(db.execute<McpUa>(sql`
      SELECT ua,
             count(DISTINCT ip)::int AS clients,
             count(*)::int           AS requests
      FROM mcp_hits
      GROUP BY ua
      ORDER BY requests DESC
      LIMIT 100
    `)),
    dailySeries('mcp_hits', 'ts'),
    dailySeries('program_snapshots', 'captured_at'),
  ]);

  const mcpDaily = (mcpDailyRows as unknown as { rows?: DayCount[] } | null)?.rows ?? [];
  const snapDaily = (snapDailyRows as unknown as { rows?: DayCount[] } | null)?.rows ?? [];

  const c = (countsRows as unknown as { rows?: Counts[] } | null)?.rows?.[0] ?? null;
  const totalUsers         = c?.total_users         ?? null;
  const totalWatchlist     = c?.total_watchlist     ?? null;
  const totalCompare       = c?.total_compare       ?? null;
  const totalNotes         = c?.total_notes         ?? null;
  const totalReports       = c?.total_reports       ?? null;
  const totalSavedFilters  = c?.total_saved_filters ?? null;
  const totalWebhooks      = c?.total_webhooks      ?? null;
  const brokenWebhooks     = c?.broken_webhooks     ?? null;
  const totalPrograms      = c?.total_programs      ?? null;
  const totalSnapshots     = c?.total_snapshots     ?? null;
  const mc = (mcpCountsRows as unknown as { rows?: McpCounts[] } | null)?.rows?.[0] ?? null;
  const mcpRequests        = mc?.mcp_requests        ?? null;
  const mcpClients         = mc?.mcp_clients         ?? null;
  const mcpRequests7d      = mc?.mcp_requests_7d     ?? null;
  const mcpClients7d       = mc?.mcp_clients_7d      ?? null;

  const mcpUa = (mcpUaRows as unknown as { rows?: McpUa[] } | null)?.rows ?? [];

  const pendingSignups = await listPendingSignups().catch(() => []);

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
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-2">Internal · noindex</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Admin</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Everything here is a live query, no caching. Refresh to re-run.
        </p>
      </header>

      <section>
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Signed-in users</h2>
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
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Index</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Programs indexed" value={totalPrograms} />
          <Tile label="Snapshots stored" value={totalSnapshots} />
        </div>
      </section>

      <section>
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">
          MCP endpoint <span className="text-neutral-700">· unauthenticated · clients = distinct IPs</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Clients (all time)" value={mcpClients} />
          <Tile label="Clients · 7d" value={mcpClients7d} />
          <Tile label="Requests (all time)" value={mcpRequests} />
          <Tile label="Requests · 7d" value={mcpRequests7d} />
        </div>
        <McpUaList items={mcpUa} />
        <p className="mt-3 mono text-[10px] text-neutral-400">
          {'// '}one row per POST, handshake calls included. IP from x-forwarded-for; a shared NAT undercounts clients.
        </p>
      </section>

      <section>
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">
          Activity <span className="text-neutral-700">· per day · last 30 days</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          <DailyBars
            title="MCP requests"
            data={mcpDaily}
            unit="req"
            note="// adoption of the agent surface"
          />
          <DailyBars
            title="Snapshots written"
            data={snapDaily}
            unit="snap"
            note="// ingest health: an empty bar is a missed cron run"
          />
        </div>
      </section>

      <section>
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Recent sign-ups <span className="text-neutral-700">· latest 20</span></h2>
        {!recentUsers ? (
          <p className="mono text-xs text-neutral-400">unavailable (DB degraded)</p>
        ) : recentUsers.length === 0 ? (
          <p className="mono text-xs text-neutral-400">no users yet</p>
        ) : (
          <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40 divide-y divide-neutral-900">
            {recentUsers.map((u) => (
              <li key={u.id} className="px-4 py-3 flex items-center gap-3">
                {u.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.image} alt="" width={24} height={24} className="w-6 h-6 rounded-full border border-neutral-800" />
                ) : (
                  <span className="w-6 h-6 rounded-full border border-neutral-800 flex items-center justify-center mono text-[10px] text-neutral-400">
                    {(u.name ?? u.email ?? '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-100 truncate">{u.name ?? u.email ?? '(no name)'}</p>
                  {u.email && u.name ? <p className="mono text-[11px] text-neutral-400 truncate">{u.email}</p> : null}
                </div>
                <p className="mono text-[10px] text-neutral-400 truncate max-w-[240px]">{u.id}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">
          Pending signups <span className="text-neutral-700">· captured during DB outage</span>
        </h2>
        {pendingSignups.length === 0 ? (
          <p className="mono text-xs text-neutral-400">none</p>
        ) : (
          <ul className="border border-amber-500/20 rounded-lg overflow-hidden bg-amber-500/[0.03] divide-y divide-neutral-900">
            {pendingSignups.map((s) => (
              <li key={s.key} className="px-4 py-3 flex items-center gap-3">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" width={24} height={24} className="w-6 h-6 rounded-full border border-neutral-800" />
                ) : (
                  <span className="w-6 h-6 rounded-full border border-neutral-800 flex items-center justify-center mono text-[10px] text-neutral-400">
                    {(s.name ?? s.email ?? '?').charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-100 truncate">{s.name ?? s.email ?? s.githubId}</p>
                  <p className="mono text-[11px] text-neutral-400 truncate">
                    {s.email ?? '(no email)'} · attempted {new Date(s.attemptedAt).toLocaleString()}
                  </p>
                </div>
                <p className="mono text-[10px] text-amber-300/70 truncate max-w-[280px]" title={s.reason}>
                  {s.reason}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 mono text-[10px] text-neutral-400">
          {'// '}entries are best-effort captures during DB outages. Replay/ping them once Neon is back.
        </p>
      </section>

      <section>
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-400 mb-3">Most-watched programs <span className="text-neutral-700">· top 10</span></h2>
        {topWatched.length === 0 ? (
          <p className="mono text-xs text-neutral-400">nobody&rsquo;s watching anything yet</p>
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
                <span className="mono text-[10px] uppercase tracking-widest text-neutral-400 ml-auto">{w.program!.platform}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface DailyBarsProps {
  title: string;
  data: Array<{ day: string; n: number }>;
  unit: string;
  note: string;
}

// Server-rendered inline-SVG daily bar chart. Single series → no legend (the title names it),
// one emerald accent, bars anchored to the baseline with a 2px surface gap, native <title> hover.
// No charting lib: 30 <rect>s is less code than a dependency and renders without client JS.
function DailyBars({ title, data, unit, note }: DailyBarsProps) {
  const unavailable = data.length === 0;
  const peak = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((s, d) => s + d.n, 0);
  // viewBox units: each day gets a 10-wide slot (8 bar + 2 gap); plot is 72 tall under a 4px headroom.
  const SLOT = 10, BAR = 8, PLOT = 72, TOP = 4;
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  return (
    <figure className="border border-neutral-900 rounded-lg p-4 bg-neutral-950/40 m-0">
      <figcaption className="flex items-baseline justify-between mb-3">
        <span className="text-sm text-neutral-100">{title}</span>
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-400 tabular-nums">
          {unavailable ? '·' : `${total.toLocaleString()} ${unit} · peak ${peak.toLocaleString()}`}
        </span>
      </figcaption>
      {unavailable ? (
        <p className="mono text-xs text-neutral-400 py-6 text-center">unavailable (DB degraded)</p>
      ) : (
        <svg
          viewBox={`0 0 ${data.length * SLOT} ${PLOT + TOP}`}
          preserveAspectRatio="none"
          className="w-full h-20"
          role="img"
          aria-label={`${title} per day over the last ${data.length} days. Total ${total} ${unit}, peak ${peak} in a day.`}
        >
          <line
            x1={0}
            y1={TOP + PLOT}
            x2={data.length * SLOT}
            y2={TOP + PLOT}
            className="stroke-neutral-800"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
          {data.map((d, i) => {
            const h = (d.n / peak) * PLOT;
            return (
              <rect
                key={d.day}
                x={i * SLOT}
                y={TOP + (PLOT - h)}
                width={BAR}
                height={h}
                rx={1.5}
                className={d.n > 0 ? 'fill-emerald-400/80' : 'fill-neutral-800'}
              >
                <title>{`${fmt(d.day)}: ${d.n.toLocaleString()} ${unit}`}</title>
                {/* zero days get a 0-height rect; the empty slot itself is the signal */}
              </rect>
            );
          })}
        </svg>
      )}
      <p className="mt-2 mono text-[10px] text-neutral-400">
        {note} · {data.length ? `${fmt(data[0].day)}–${fmt(data[data.length - 1].day)}` : '30d'}
      </p>
    </figure>
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
    ? 'text-neutral-400'
    : tone === 'warn' && value > 0
    ? 'text-amber-300'
    : 'text-neutral-100';
  return (
    <div className="border border-neutral-900 rounded-lg p-4 bg-neutral-950/40">
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
        {unavailable ? '·' : value.toLocaleString()}
      </p>
    </div>
  );
}
