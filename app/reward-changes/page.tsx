import type { Metadata } from 'next';
import Link from 'next/link';
import { getRecentChanges, type RecentChange } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META } from '@/lib/format';
import { RssIcon } from '@/app/_ui/icons';

export const dynamic = 'force-dynamic';

const DEFAULT_HOURS = 720; // 30 days — reward changes are rarer than scope changes.

export const metadata: Metadata = {
  title: 'Reward changes · Bounty Index',
  description:
    'Just the money moves. Every max-payout bump or cut across HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy, and Immunefi.',
  alternates: {
    canonical: '/reward-changes',
    types: { 'application/rss+xml': '/reward-changes.xml' },
  },
};

function isoDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

interface PageProps {
  searchParams: Promise<{ hours?: string }>;
}

export default async function RewardChangesPage({ searchParams }: PageProps) {
  const { hours: hoursParam } = await searchParams;
  const parsed = hoursParam ? parseInt(hoursParam, 10) : NaN;
  const hoursBack = Number.isFinite(parsed) && parsed > 0 && parsed <= 24 * 90 ? parsed : DEFAULT_HOURS;

  let changes: RecentChange[] = [];
  let dbError: string | null = null;
  try {
    // Pull a wide window then filter; reward changes are rare (< 5% of all diffs).
    const all = await getRecentChanges(hoursBack, 1000);
    changes = all.filter((c) => c.diff.rewardDelta);
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'DB error';
  }

  const groups = new Map<string, RecentChange[]>();
  for (const c of changes) {
    const key = isoDate(c.capturedAt);
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const windowLabel = hoursBack === 24 ? '24 hours' : hoursBack === 168 ? '7 days' : hoursBack === 720 ? '30 days' : `${hoursBack}h`;

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10">
      <div className="flex items-end justify-between border-b border-neutral-900 pb-6 reveal">
        <div>
          <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Changelog · reward moves only</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Reward changes</h1>
          <p className="text-neutral-400 mt-2">
            Just the money moves. Max-payout bumps and cuts across all platforms — the last{' '}
            <span className="text-neutral-100 tabular-nums">{windowLabel}</span>.{' '}
            <Link href="/whats-new" className="text-emerald-400 hover:underline">All changes →</Link>
          </p>
        </div>
        <a
          href="/reward-changes.xml"
          className="focus-ring mono text-xs px-3 py-1.5 border border-neutral-800 rounded-md text-neutral-400 hover:text-emerald-400 hover:border-neutral-600 transition inline-flex items-center gap-2"
        >
          <RssIcon size={12} />
          RSS
        </a>
      </div>

      {dbError ? (
        <div className="mt-8 border border-amber-900/60 bg-amber-950/30 rounded-lg p-4 text-sm text-amber-200/80">
          <p className="mono text-xs text-amber-400 mb-2">INDEX_READ_ONLY</p>
          <p>Change history is paused while the index reconnects. Program list and scope lookup are still live.</p>
        </div>
      ) : changes.length === 0 ? (
        <div className="mt-10 space-y-3">
          <p className="mono text-xs text-neutral-500">— no reward changes in the last <span className="text-neutral-300 tabular-nums">{windowLabel}</span> —</p>
          <p className="text-sm text-neutral-500">
            Try widening the window:
            {' '}
            <Link href="/reward-changes?hours=2160" className="text-emerald-400 hover:underline">90 days</Link>
            {' · '}
            <Link href="/reward-changes?hours=720" className="text-emerald-400 hover:underline">30 days</Link>
            {' · '}
            <Link href="/reward-changes?hours=168" className="text-emerald-400 hover:underline">7 days</Link>
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {[...groups.entries()].map(([date, entries]) => (
            <section key={date} className="md:grid md:grid-cols-[92px_1fr] md:gap-6">
              <div className="mb-3 md:mb-0 md:pt-1 flex md:block items-baseline gap-3">
                <p className="mono text-xs text-neutral-500 tabular-nums">{date}</p>
                <p className="mono text-[10px] uppercase tracking-widest text-neutral-700 md:mt-1">
                  {entries.length} {entries.length === 1 ? 'move' : 'moves'}
                </p>
              </div>
              <ul>
                {entries.map((c, i) => (
                  <li
                    key={`${c.program.id}-${c.capturedAt.getTime()}`}
                    className={`${i === entries.length - 1 ? '' : 'border-b border-neutral-900'} group`}
                  >
                    <Link
                      href={`/programs/${c.program.platform}/${c.program.slug}`}
                      className="flex items-start gap-3 py-3.5 md:py-3 hover:bg-neutral-900/40 active:bg-neutral-900/60 -mx-3 px-3 rounded transition"
                    >
                      <span className={`shrink-0 w-1.5 h-1.5 mt-2 rounded-full ${PLATFORM_META[c.program.platform]?.dot ?? 'bg-neutral-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-neutral-100 group-hover:text-emerald-400 transition truncate">
                          {c.program.name}
                        </p>
                        <p className="mono text-[11px] text-neutral-500 mt-0.5">{platformLabel(c.program.platform)}</p>
                        <RewardDeltaRow delta={c.diff.rewardDelta!} currency={c.program.currency ?? 'USD'} />
                      </div>
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

interface RewardDeltaRowProps {
  delta: NonNullable<RecentChange['diff']['rewardDelta']>;
  currency: string;
}

function RewardDeltaRow({ delta, currency }: RewardDeltaRowProps) {
  const from = delta.from != null ? formatBounty(delta.from, currency) : '—';
  const to = delta.to != null ? formatBounty(delta.to, currency) : '—';
  const direction =
    delta.from != null && delta.to != null
      ? delta.to > delta.from
        ? 'up'
        : delta.to < delta.from
          ? 'down'
          : 'flat'
      : 'new';
  const arrowColor =
    direction === 'up'
      ? 'text-emerald-300'
      : direction === 'down'
        ? 'text-amber-300'
        : 'text-neutral-400';
  return (
    <div className="mt-2 mono text-[11px] flex items-center gap-2">
      <span className="text-neutral-500">max reward</span>
      <span className="text-neutral-300 tabular-nums">{from}</span>
      <span className={arrowColor}>→</span>
      <span className="text-neutral-100 tabular-nums">{to}</span>
    </div>
  );
}
