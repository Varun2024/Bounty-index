import type { Metadata } from 'next';
import Link from 'next/link';
import { getRecentChanges, type RecentChange } from '@/lib/db/queries';
import { platformLabel, PLATFORM_META, shortenIdentifier } from '@/lib/format';
import { RssIcon } from '@/app/_ui/icons';

export const dynamic = 'force-dynamic';

const DEFAULT_HOURS = 168;

export const metadata: Metadata = {
  title: "What's new · Bounty Index",
  description:
    "Every scope, reward, and safe-harbor change across HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy, and Immunefi — the last 7 days at a glance.",
  alternates: {
    canonical: '/whats-new',
    types: { 'application/rss+xml': '/whats-new.xml' },
  },
};

function isoDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

interface PageProps {
  searchParams: Promise<{ hours?: string }>;
}

export default async function WhatsNewPage({ searchParams }: PageProps) {
  const { hours: hoursParam } = await searchParams;
  const parsed = hoursParam ? parseInt(hoursParam, 10) : NaN;
  const hoursBack = Number.isFinite(parsed) && parsed > 0 && parsed <= 24 * 30 ? parsed : DEFAULT_HOURS;

  let changes: RecentChange[] = [];
  let dbError: string | null = null;
  try {
    changes = await getRecentChanges(hoursBack);
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'DB error';
  }

  // Group by day (date of capturedAt).
  const groups = new Map<string, RecentChange[]>();
  for (const c of changes) {
    const key = isoDate(c.capturedAt);
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const windowLabel = hoursBack === 24 ? '24 hours' : hoursBack === 168 ? '7 days' : `${hoursBack}h`;

  return (
    <div className="max-w-[1000px] mx-auto px-6 py-10">
      <div className="flex items-end justify-between border-b border-neutral-900 pb-6 reveal">
        <div>
          <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Changelog</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">What&rsquo;s new</h1>
          <p className="text-neutral-400 mt-2">
            Every scope, reward, and safe-harbor change across all platforms — the last {windowLabel}.
          </p>
        </div>
        <a
          href="/whats-new.xml"
          className="focus-ring mono text-xs px-3 py-1.5 border border-neutral-800 rounded-md text-neutral-400 hover:text-emerald-400 hover:border-neutral-600 transition inline-flex items-center gap-2"
        >
          <RssIcon size={12} />
          RSS
        </a>
      </div>

      {dbError ? (
        <p className="mono text-xs text-amber-400 mt-8">DB_NOT_CONNECTED</p>
      ) : changes.length === 0 ? (
        <div className="mt-10 space-y-3">
          <p className="mono text-xs text-neutral-500">— no changes in the last {windowLabel} —</p>
          <p className="text-sm text-neutral-500">
            Try widening the window:
            {' '}
            <Link href="/whats-new?hours=720" className="text-emerald-400 hover:underline">30 days</Link>
            {' · '}
            <Link href="/whats-new?hours=168" className="text-emerald-400 hover:underline">7 days</Link>
            {' · '}
            <Link href="/whats-new?hours=24" className="text-emerald-400 hover:underline">24 hours</Link>
          </p>
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {[...groups.entries()].map(([date, entries]) => (
            <section key={date} className="md:grid md:grid-cols-[92px_1fr] md:gap-6">
              <div className="mb-3 md:mb-0 md:pt-1 flex md:block items-baseline gap-3">
                <p className="mono text-xs text-neutral-500 tabular-nums">{date}</p>
                <p className="mono text-[10px] uppercase tracking-widest text-neutral-700 md:mt-1">
                  {entries.length} {entries.length === 1 ? 'change' : 'changes'}
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
                        <DiffSummary diff={c.diff} />
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

function DiffSummary({ diff }: { diff: RecentChange['diff'] }) {
  const bits: React.ReactNode[] = [];
  if (diff.added.length) {
    bits.push(
      <span key="added" className="text-emerald-300">
        +{diff.added.length} added
      </span>,
    );
  }
  if (diff.removed.length) {
    bits.push(
      <span key="removed" className="text-amber-300">
        −{diff.removed.length} removed
      </span>,
    );
  }
  if (diff.rewardDelta) {
    bits.push(
      <span key="reward" className="text-neutral-200">
        reward {diff.rewardDelta.from ?? '—'} → {diff.rewardDelta.to ?? '—'}
      </span>,
    );
  }
  if (diff.safeHarborChanged) {
    bits.push(
      <span key="sh" className="text-neutral-200">
        safe-harbor {diff.safeHarborChanged.from ?? '—'} → {diff.safeHarborChanged.to ?? '—'}
      </span>,
    );
  }

  const sampleIds = [...diff.added.slice(0, 3), ...diff.removed.slice(0, 3)].map((s) => shortenIdentifier(s, 44));

  return (
    <div className="mt-2 space-y-1">
      <div className="mono text-[11px] flex flex-wrap gap-x-3 gap-y-1">
        {bits.map((b, i) => (
          <span key={i}>{b}</span>
        ))}
      </div>
      {sampleIds.length > 0 && (
        <p className="mono text-[11px] text-neutral-500 truncate">
          {sampleIds.join(', ')}
          {diff.added.length + diff.removed.length > sampleIds.length && ` · +${diff.added.length + diff.removed.length - sampleIds.length} more`}
        </p>
      )}
    </div>
  );
}
