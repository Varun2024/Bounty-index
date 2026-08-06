import Link from 'next/link';
import type { Metadata } from 'next';
import { getWatchlist, type WatchlistEntry, type SnapshotPayloadShape } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META, relativeTime } from '@/lib/format';
import { WatchlistSync } from './sync';
import { UnwatchButton } from './unwatch-button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Watchlist · Bounty Index',
  description: 'Programs you watch, with scope and reward changes since the last snapshot.',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseIds(v: string | string[] | undefined): number[] {
  if (!v) return [];
  const raw = Array.isArray(v) ? v.join(',') : v;
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export default async function WatchlistPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const ids = parseIds(sp.ids);
  const entries = ids.length ? await getWatchlist(ids).catch(() => [] as WatchlistEntry[]) : [];

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      <WatchlistSync />
      <header className="mb-8">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Signals</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Watchlist</h1>
        <p className="mt-3 text-sm text-neutral-400 max-w-2xl">
          Programs you watch, with the most recent scope and reward changes tracked from daily snapshots.
          Selection lives in your browser — no account needed.
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState hasIds={ids.length > 0} />
      ) : (
        <ul className="space-y-6">
          {entries.map((e) => (
            <WatchlistRow key={e.program.id} entry={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ hasIds }: { hasIds: boolean }) {
  return (
    <div className="border border-neutral-900 rounded-lg p-12 bg-neutral-950/40 text-center">
      <p className="mono text-xs uppercase tracking-widest text-neutral-500">
        {hasIds ? '— syncing your watchlist —' : '— nothing on the watch yet —'}
      </p>
      {!hasIds && (
        <>
          <p className="mt-3 text-neutral-400 text-sm">
            Open any program and hit <span className="mono text-amber-300">☆ watch</span> to track its scope and reward changes.
          </p>
          <Link
            href="/programs"
            className="mt-6 inline-flex items-center gap-2 mono text-sm px-4 py-2 border border-neutral-800 rounded-md text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900 transition"
          >
            browse programs →
          </Link>
        </>
      )}
    </div>
  );
}

function WatchlistRow({ entry }: { entry: WatchlistEntry }) {
  const { program, latest, previous, latestAt } = entry;
  const diff = diffSnapshots(previous, latest);
  const hasChanges = diff && (diff.added.length > 0 || diff.removed.length > 0 || diff.rewardDelta !== null || diff.safeHarborChanged);
  const dot = PLATFORM_META[program.platform]?.dot ?? 'bg-neutral-500';

  return (
    <li className={`border rounded-xl overflow-hidden bg-neutral-950/40 ${hasChanges ? 'border-amber-400/30' : 'border-neutral-900'}`}>
      <div className="flex items-start gap-4 px-5 py-4 border-b border-neutral-900">
        <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${dot}`} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/programs/${program.platform}/${program.slug}`}
            className="text-neutral-100 hover:text-emerald-400 transition font-medium block truncate"
          >
            {program.name}
          </Link>
          <p className="mono text-[11px] text-neutral-500 mt-1">
            {platformLabel(program.platform)}
            <span className="text-neutral-700"> · </span>
            {program.maxBounty ? (
              <span className="text-emerald-300">up to {formatBounty(program.maxBounty, program.currency ?? 'USD')}</span>
            ) : (
              <span>no payout listed</span>
            )}
            {latestAt && (
              <>
                <span className="text-neutral-700"> · </span>
                <span>snapshot {relativeTime(latestAt)}</span>
              </>
            )}
          </p>
        </div>
        <UnwatchButton programId={program.id} />
      </div>

      {hasChanges && diff ? (
        <div className="px-5 py-4 space-y-2 bg-amber-400/[0.02]">
          <p className="mono text-[10px] uppercase tracking-widest text-amber-400">Changes since previous snapshot</p>
          {diff.rewardDelta !== null && (
            <ChangeLine>
              <span className="text-neutral-500">max payout: </span>
              <span className="mono text-neutral-500 line-through">{formatBounty(diff.rewardDelta.from, program.currency ?? 'USD')}</span>
              <span className="text-neutral-600"> → </span>
              <span className="mono text-emerald-300">{formatBounty(diff.rewardDelta.to, program.currency ?? 'USD')}</span>
            </ChangeLine>
          )}
          {diff.safeHarborChanged && (
            <ChangeLine>
              <span className="text-neutral-500">safe harbor: </span>
              <span className="mono text-neutral-500 line-through">{diff.safeHarborChanged.from ?? 'unknown'}</span>
              <span className="text-neutral-600"> → </span>
              <span className="mono text-emerald-300">{diff.safeHarborChanged.to ?? 'unknown'}</span>
            </ChangeLine>
          )}
          {diff.added.length > 0 && (
            <IdentifierBlock label={`added · ${diff.added.length}`} identifiers={diff.added} glyph="+" glyphColor="text-emerald-400" />
          )}
          {diff.removed.length > 0 && (
            <IdentifierBlock label={`removed · ${diff.removed.length}`} identifiers={diff.removed} glyph="−" glyphColor="text-red-400" />
          )}
        </div>
      ) : (
        <p className="px-5 py-3 mono text-[11px] text-neutral-600">
          {!previous ? '// only one snapshot on record — changes appear after the next ingest' : '// no changes since previous snapshot'}
        </p>
      )}
    </li>
  );
}

function ChangeLine({ children }: { children: React.ReactNode }) {
  return <p className="mono text-xs">{children}</p>;
}

function IdentifierBlock({
  label,
  identifiers,
  glyph,
  glyphColor,
}: {
  label: string;
  identifiers: string[];
  glyph: string;
  glyphColor: string;
}) {
  return (
    <div>
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1">{label}</p>
      <ul className="space-y-0.5">
        {identifiers.slice(0, 20).map((id) => (
          <li key={id}>
            <code className="mono text-[11px] text-neutral-300 break-all">
              <span className={`${glyphColor} mr-1`}>{glyph}</span>
              {id}
            </code>
          </li>
        ))}
        {identifiers.length > 20 && (
          <li className="mono text-[10px] text-neutral-600 italic">…and {identifiers.length - 20} more</li>
        )}
      </ul>
    </div>
  );
}

// --- diff helpers ---

interface SnapshotDiff {
  added: string[];
  removed: string[];
  rewardDelta: { from: number | null; to: number | null } | null;
  safeHarborChanged: { from: string | null; to: string | null } | null;
}

function diffSnapshots(prev: SnapshotPayloadShape | null, cur: SnapshotPayloadShape | null): SnapshotDiff | null {
  if (!cur || !prev) return null;
  const prevIds = new Set(prev.scopeIdentifiers);
  const curIds = new Set(cur.scopeIdentifiers);
  const added = cur.scopeIdentifiers.filter((id) => !prevIds.has(id));
  const removed = prev.scopeIdentifiers.filter((id) => !curIds.has(id));
  const rewardDelta =
    prev.maxBounty !== cur.maxBounty ? { from: prev.maxBounty, to: cur.maxBounty } : null;
  const safeHarborChanged =
    prev.safeHarbor !== cur.safeHarbor ? { from: prev.safeHarbor, to: cur.safeHarbor } : null;
  return { added, removed, rewardDelta, safeHarborChanged };
}
