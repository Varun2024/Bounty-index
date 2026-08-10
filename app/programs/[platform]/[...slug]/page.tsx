import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProgramBySlug, getProgramSnapshots, type ProgramSnapshot } from '@/lib/db/queries';
import { getNote } from '@/app/actions/notes';
import { getUserReport, getProgramReportStats } from '@/app/actions/reports';
import { formatBounty, formatPayoutRange, platformLabel, PLATFORM_META, relativeTime, scopeHref, shortenIdentifier } from '@/lib/format';
import { diffSnapshots, isEmptyDiff, summarizeActivity } from '@/lib/snapshots';
import { extractCompanyDomain } from '@/lib/program-domain';
import { ExternalIcon } from '@/app/_ui/icons';
import { CompareButton } from '@/app/_ui/compare-button';
import { WatchButton } from '@/app/_ui/watch-button';
import { PlatformLogo } from '@/app/_ui/platform-logo';
import { CompanyLogo } from '@/app/_ui/company-logo';
import { ProgramNotes } from '@/app/_ui/program-notes';
import { CommunityReports } from '@/app/_ui/community-reports';
import { SectionHeading } from '@/app/_ui/section-heading';
import { LifecycleChart } from './lifecycle-chart';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ platform: string; slug: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { platform, slug } = await params;
  const fullSlug = slug.join('/');
  const result = await getProgramBySlug(platform, fullSlug).catch(() => null);
  if (!result) return { title: 'Program not found · Bounty Index' };
  const { program, scopes } = result;
  const inScope = scopes.filter((s) => s.inScope);
  const platformLabel = program.platform.charAt(0).toUpperCase() + program.platform.slice(1);
  const typeWord = program.offersBounty ? 'Bug Bounty Program' : 'Vulnerability Disclosure Program';
  const payoutBit = formatPayoutForMeta(program.minBounty, program.maxBounty, program.currency ?? 'USD');
  const title = payoutBit
    ? `${program.name} ${typeWord} on ${platformLabel} — Payout ${payoutBit}`
    : `${program.name} ${typeWord} on ${platformLabel}`;
  const description = buildProgramDescription(program.name, platformLabel, program.offersBounty, payoutBit, inScope);
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary', title, description },
    alternates: {
      canonical: `/programs/${program.platform}/${program.slug}`,
      types: { 'application/rss+xml': `/rss/programs/${program.platform}/${program.slug}` },
    },
  };
}

function formatPayoutForMeta(min: number | null, max: number | null, currency: string): string {
  const sym = currency === 'EUR' ? '€' : '$';
  const fmt = (n: number): string => {
    if (n >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1000) return `${sym}${Math.round(n / 1000)}K`;
    return `${sym}${n}`;
  };
  if (min && max) return `${fmt(min)}–${fmt(max)}`;
  if (max) return `up to ${fmt(max)}`;
  if (min) return `from ${fmt(min)}`;
  return '';
}

interface InScopeItem {
  assetType: string;
}

function buildProgramDescription(
  name: string,
  platformLabel: string,
  offersBounty: boolean,
  payoutBit: string,
  inScope: InScopeItem[],
): string {
  const typeWord = offersBounty ? 'runs a bug bounty program' : 'runs a vulnerability disclosure program';
  const payoutPart = payoutBit ? `, payouts ${payoutBit}` : '';
  const total = inScope.length;
  // Compose an asset-type breakdown like "5 URLs, 2 APIs" — top 3 buckets.
  const buckets = new Map<string, number>();
  for (const s of inScope) buckets.set(s.assetType, (buckets.get(s.assetType) ?? 0) + 1);
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const breakdown = sorted.length
    ? sorted.map(([type, n]) => `${n} ${type}${n === 1 ? '' : 's'}`).join(', ')
    : '';
  const base = `${name} ${typeWord} on ${platformLabel}${payoutPart}. ${total} in-scope asset${total === 1 ? '' : 's'}`;
  const full = breakdown ? `${base}: ${breakdown}.` : `${base}.`;
  // Meta descriptions cap ~160 chars; truncate defensively.
  return full.length > 158 ? full.slice(0, 155) + '…' : full;
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const { platform, slug } = await params;
  const fullSlug = slug.join('/');
  const result = await getProgramBySlug(platform, fullSlug);
  if (!result) notFound();
  const { program, scopes } = result;
  const [snapshots, initialNote, initialReportStats, initialUserReport] = await Promise.all([
    getProgramSnapshots(program.id).catch(() => [] as ProgramSnapshot[]),
    getNote(program.id).catch(() => ({ content: '', updatedAt: null })),
    getProgramReportStats(program.id).catch(() => ({ count: 0, waitingCount: 0, medianFirstResponseDays: null })),
    getUserReport(program.id).catch(() => null),
  ]);
  const inScope = scopes.filter((s) => s.inScope);
  const outOfScope = scopes.filter((s) => !s.inScope);
  const platformDot = PLATFORM_META[program.platform]?.dot ?? 'bg-neutral-500';
  const payout = formatPayoutRange(program.minBounty, program.maxBounty, program.currency ?? 'USD');
  const companyDomain = extractCompanyDomain(scopes, program.name);
  const activity = summarizeActivity(snapshots, 7);
  const hasActivity = activity.hasBaseline && (activity.addedCount > 0 || activity.removedCount > 0 || activity.rewardChanged);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bountyindex.in';
  const encodedSlug = program.slug.split('/').map(encodeURIComponent).join('/');
  const encodedPlatform = encodeURIComponent(program.platform);
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Programs', item: `${siteUrl}/programs` },
      { '@type': 'ListItem', position: 2, name: platformLabel(program.platform), item: `${siteUrl}/programs?platform=${encodedPlatform}` },
      { '@type': 'ListItem', position: 3, name: program.name, item: `${siteUrl}/programs/${encodedPlatform}/${encodedSlug}` },
    ],
  };

  return (
    <div className="relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {/* Breadcrumb */}
      <div className="border-b border-neutral-900">
        <div className="max-w-[1100px] mx-auto px-6 py-4 mono text-xs flex items-center gap-2">
          <Link href="/programs" className="text-neutral-500 hover:text-neutral-300 transition">programs</Link>
          <span className="text-neutral-700">/</span>
          <Link href={`/programs?platform=${program.platform}`} className="text-neutral-500 hover:text-neutral-300 transition inline-flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${platformDot}`} />
            {platformLabel(program.platform)}
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-emerald-400 truncate">{program.slug}</span>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-10">
        {/* Hero */}
        <section className="border-b border-neutral-900 pb-8 reveal">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0 flex items-start gap-4">
              <CompanyLogo domain={companyDomain} name={program.name} size={48} className="mt-1" />
              <div className="min-w-0">
                <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-neutral-50 break-words">{program.name}</h1>
                <div className="mt-3 mono text-xs text-neutral-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-2">
                    <PlatformLogo platform={program.platform} size="sm" />
                    {platformLabel(program.platform)}
                  </span>
                  <span className="text-neutral-700">·</span>
                  {payout ? (
                    <>
                      <span className="text-emerald-300">{payout.label} {payout.value}</span>
                      <span className="text-neutral-700">·</span>
                    </>
                  ) : null}
                  <span>{inScope.length} in-scope · {outOfScope.length} out</span>
                  {program.lastUpdatedAt && (
                    <>
                      <span className="text-neutral-700">·</span>
                      <span>updated {relativeTime(program.lastUpdatedAt)}</span>
                    </>
                  )}
                  {hasActivity && (
                    <>
                      <span className="text-neutral-700">·</span>
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300"
                        title={`Scope changes in the last ${activity.windowDays} days`}
                      >
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        {activity.addedCount > 0 && <span>+{activity.addedCount}</span>}
                        {activity.removedCount > 0 && <span className="text-amber-300">−{activity.removedCount}</span>}
                        {activity.rewardChanged && <span>reward</span>}
                        <span className="text-neutral-500">· {activity.windowDays}d</span>
                      </span>
                    </>
                  )}
                  <span className="text-neutral-700">·</span>
                  <a
                    href={`/rss/programs/${program.platform}/${program.slug}`}
                    className="text-neutral-400 hover:text-emerald-300 transition-colors"
                    title="RSS feed of scope changes"
                  >
                    RSS
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <WatchButton programId={program.id} />
              <CompareButton programId={program.id} />
              <a
                href={program.url}
                target="_blank"
                rel="noreferrer"
                className="focus-ring cta-arrow mono text-sm px-4 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition shadow-[0_0_40px_-10px] shadow-emerald-400/70 inline-flex items-center gap-2"
              >
                open program <ExternalIcon size={12} className="arrow" />
              </a>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 mono text-[11px]">
            <Tag active={program.offersBounty}>{program.programType}</Tag>
            {program.offersSwag && <Tag>swag</Tag>}
            {program.managed && <Tag>managed</Tag>}
            {program.submissionState && <Tag>{program.submissionState}</Tag>}
            {program.handle && program.handle !== program.slug && <Tag>@{program.handle}</Tag>}
          </div>
        </section>

        {/* Scope: split columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10 reveal reveal-delay-1">
          <ScopeColumn kind="in" items={inScope} />
          <ScopeColumn kind="out" items={outOfScope} />
        </div>

        <CommunityReports
          programId={program.id}
          programName={program.name}
          initialStats={initialReportStats}
          initialUserReport={initialUserReport}
        />

        <ProgramNotes programId={program.id} initialNote={initialNote} />

        <ProgramTimeline snapshots={snapshots} currency={program.currency ?? 'USD'} />
      </div>
    </div>
  );
}

interface ProgramTimelineProps {
  snapshots: ProgramSnapshot[];
  currency: string;
}

function ProgramTimeline({ snapshots, currency }: ProgramTimelineProps) {
  if (snapshots.length === 0) return null;

  // Walk chronologically; each snapshot's entry describes the diff from its predecessor.
  // The first snapshot is always "first indexed" — no diff.
  const entries = snapshots.map((snap, i) => ({
    capturedAt: snap.capturedAt,
    diff: i === 0 ? null : diffSnapshots(snapshots[i - 1].payload, snap.payload),
    isFirst: i === 0,
    payload: snap.payload,
  }));

  // Show newest first.
  const reversed = [...entries].reverse();

  const meaningfulChanges = reversed.filter((e) => e.isFirst || !isEmptyDiff(e.diff));

  return (
    <section className="mt-14 reveal reveal-delay-2">
      <SectionHeading title="History" className="mb-4">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
          {meaningfulChanges.length} event{meaningfulChanges.length === 1 ? '' : 's'}
        </span>
      </SectionHeading>
      {snapshots.length >= 2 && <LifecycleChart snapshots={snapshots} />}
      <ol className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
        {meaningfulChanges.map((e, i) => (
          <li key={e.capturedAt.toISOString()} className={i === meaningfulChanges.length - 1 ? '' : 'border-b border-neutral-900'}>
            <TimelineEntry entry={e} currency={currency} />
          </li>
        ))}
      </ol>
      {snapshots.length === 1 && (
        <p className="mono text-[11px] text-neutral-600 mt-3">
          <span className="text-neutral-700">{'// '}</span>
          only one snapshot on record — changes appear from the next ingest onward
        </p>
      )}
    </section>
  );
}

interface TimelineEntryProps {
  entry: {
    capturedAt: Date;
    diff: ReturnType<typeof diffSnapshots>;
    isFirst: boolean;
    payload: import('@/lib/db/queries').SnapshotPayloadShape;
  };
  currency: string;
}

function TimelineEntry({ entry, currency }: TimelineEntryProps) {
  const dateLabel = entry.capturedAt.toISOString().slice(0, 10);
  const rel = relativeTime(entry.capturedAt);

  if (entry.isFirst) {
    return (
      <div className="flex items-start gap-4 px-4 py-3">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums shrink-0 w-24 mt-0.5">
          {dateLabel}
        </span>
        <div className="flex-1">
          <p className="mono text-xs text-neutral-300">first indexed</p>
          <p className="mono text-[10px] text-neutral-600 mt-0.5">{rel} · {entry.payload.inScopeCount} in-scope assets</p>
        </div>
      </div>
    );
  }

  const diff = entry.diff;
  if (!diff) return null;

  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums shrink-0 w-24 mt-0.5">
        {dateLabel}
      </span>
      <div className="flex-1 space-y-1">
        {diff.rewardDelta !== null && (
          <p className="mono text-xs">
            <span className="text-neutral-500">reward: </span>
            <span className="text-neutral-500 line-through">{formatBounty(diff.rewardDelta.from, currency)}</span>
            <span className="text-neutral-700"> → </span>
            <span className="text-emerald-300">{formatBounty(diff.rewardDelta.to, currency)}</span>
          </p>
        )}
        {diff.safeHarborChanged && (
          <p className="mono text-xs">
            <span className="text-neutral-500">safe harbor: </span>
            <span className="text-neutral-500 line-through">{diff.safeHarborChanged.from ?? 'unknown'}</span>
            <span className="text-neutral-700"> → </span>
            <span className="text-emerald-300">{diff.safeHarborChanged.to ?? 'unknown'}</span>
          </p>
        )}
        {diff.added.length > 0 && (
          <p className="mono text-xs">
            <span className="text-emerald-400">+ added </span>
            <span className="text-neutral-500">{diff.added.length} scope{diff.added.length === 1 ? '' : 's'}</span>
            {diff.added.length <= 3 && (
              <span className="text-neutral-600"> · {diff.added.join(', ')}</span>
            )}
          </p>
        )}
        {diff.removed.length > 0 && (
          <p className="mono text-xs">
            <span className="text-red-400">− removed </span>
            <span className="text-neutral-500">{diff.removed.length} scope{diff.removed.length === 1 ? '' : 's'}</span>
            {diff.removed.length <= 3 && (
              <span className="text-neutral-600"> · {diff.removed.join(', ')}</span>
            )}
          </p>
        )}
        <p className="mono text-[10px] text-neutral-600">{rel}</p>
      </div>
    </div>
  );
}

interface TagProps {
  active?: boolean;
  children: React.ReactNode;
}

function Tag({ active, children }: TagProps) {
  return (
    <span
      className={`px-2 py-1 rounded border uppercase tracking-widest ${
        active
          ? 'border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300'
          : 'border-neutral-800 bg-neutral-900/40 text-neutral-400'
      }`}
    >
      {children}
    </span>
  );
}

interface ScopeItem {
  id: number;
  identifier: string;
  assetType: string;
  severity: string | null;
}

interface ScopeColumnProps {
  kind: 'in' | 'out';
  items: ScopeItem[];
}

// Hunter-order: what they scan first, then edge cases. Anything unknown falls at the end.
const ASSET_TYPE_ORDER = ['wildcard', 'url', 'api', 'android', 'ios', 'source_code', 'hardware', 'smart_contract', 'other'];

const ASSET_TYPE_LABEL: Record<string, string> = {
  wildcard: 'wildcards',
  url: 'urls',
  api: 'apis',
  android: 'android',
  ios: 'ios',
  source_code: 'source code',
  hardware: 'hardware',
  smart_contract: 'smart contracts',
  other: 'other',
};

function groupByAssetType(items: ScopeItem[]): { type: string; items: ScopeItem[] }[] {
  const buckets = new Map<string, ScopeItem[]>();
  for (const item of items) {
    const t = item.assetType || 'other';
    const existing = buckets.get(t);
    if (existing) existing.push(item);
    else buckets.set(t, [item]);
  }
  const knownOrdered = ASSET_TYPE_ORDER.filter((t) => buckets.has(t)).map((t) => ({ type: t, items: buckets.get(t)! }));
  const unknown = [...buckets.keys()].filter((t) => !ASSET_TYPE_ORDER.includes(t)).map((t) => ({ type: t, items: buckets.get(t)! }));
  return [...knownOrdered, ...unknown];
}

function ScopeColumn({ kind, items }: ScopeColumnProps) {
  const isIn = kind === 'in';
  const title = isIn ? 'In scope' : 'Out of scope';
  const buckets = groupByAssetType(items);
  const shouldGroup = buckets.length > 1;

  return (
    <section>
      <SectionHeading title={title}>
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
          {items.length.toString().padStart(3, '0')}
        </span>
      </SectionHeading>
      {items.length === 0 ? (
        <p className="mono text-xs text-neutral-600 py-6">— none listed —</p>
      ) : shouldGroup ? (
        <div className="space-y-5">
          {buckets.map((bucket) => (
            <ScopeBucket
              key={bucket.type}
              type={bucket.type}
              items={bucket.items}
              kind={kind}
              showTypeTag={false}
            />
          ))}
        </div>
      ) : (
        <ScopeList items={items} kind={kind} showTypeTag={true} />
      )}
    </section>
  );
}

interface ScopeBucketProps {
  type: string;
  items: ScopeItem[];
  kind: 'in' | 'out';
  showTypeTag: boolean;
}

function ScopeBucket({ type, items, kind, showTypeTag }: ScopeBucketProps) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="mono text-[10px] uppercase tracking-widest text-emerald-400/80">
          {ASSET_TYPE_LABEL[type] ?? type}
        </span>
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
          {items.length.toString().padStart(2, '0')}
        </span>
      </div>
      <ScopeList items={items} kind={kind} showTypeTag={showTypeTag} />
    </div>
  );
}

interface ScopeListProps {
  items: ScopeItem[];
  kind: 'in' | 'out';
  showTypeTag: boolean;
}

// Long buckets get collapsed via native <details>. Threshold matches the "you can scan this
// in one glance" line — above it the wall of URLs stops being useful and the collapse wins.
const SCOPE_LIST_INLINE_LIMIT = 10;

function ScopeList({ items, kind, showTypeTag }: ScopeListProps) {
  const isIn = kind === 'in';
  const glyph = isIn ? '+' : '−';
  const glyphColor = isIn ? 'text-emerald-400' : 'text-neutral-600';

  const overflow = Math.max(0, items.length - SCOPE_LIST_INLINE_LIMIT);
  const inline = overflow > 0 ? items.slice(0, SCOPE_LIST_INLINE_LIMIT) : items;
  const rest = overflow > 0 ? items.slice(SCOPE_LIST_INLINE_LIMIT) : [];

  const renderRow = (s: ScopeItem, isLast: boolean) => {
    const href = scopeHref(s.identifier);
    const rowClass = `flex items-center gap-3 px-4 py-3 md:py-2.5 ${isLast ? '' : 'border-b border-neutral-900'} hover:bg-neutral-900/40 active:bg-neutral-900/60 transition group`;
    const display = shortenIdentifier(s.identifier);
    const body = (
      <>
        <span className={`mono text-sm ${glyphColor} shrink-0 w-3`}>{glyph}</span>
        <code
          title={display === s.identifier ? undefined : s.identifier}
          className={`mono text-xs break-all flex-1 ${href ? 'text-neutral-200 group-hover:text-emerald-300' : 'text-neutral-300'}`}
        >
          {display}
        </code>
        {href && (
          <ExternalIcon size={10} className="text-neutral-700 group-hover:text-emerald-400 shrink-0 transition" />
        )}
        {showTypeTag && (
          <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 shrink-0">{s.assetType}</span>
        )}
        {s.severity && (
          <span className="mono text-[10px] uppercase tracking-widest text-neutral-500 shrink-0">· {s.severity}</span>
        )}
      </>
    );
    return href ? (
      <li key={s.id}>
        <a href={href} target="_blank" rel="noreferrer noopener" className={rowClass}>{body}</a>
      </li>
    ) : (
      <li key={s.id} className={rowClass}>{body}</li>
    );
  };

  return (
    <ul className={`border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40 ${isIn ? '' : 'opacity-80'}`}>
      {inline.map((s, i) => renderRow(s, i === inline.length - 1 && overflow === 0))}
      {overflow > 0 && (
        <li>
          <details className="group/details">
            <summary className="mono text-[11px] uppercase tracking-widest text-neutral-500 hover:text-emerald-400 cursor-pointer list-none px-4 py-3 flex items-center gap-2 transition select-none">
              <span className="text-neutral-700 group-open/details:hidden">▸</span>
              <span className="text-neutral-700 hidden group-open/details:inline">▾</span>
              <span className="group-open/details:hidden">show <span className="text-neutral-200 tabular-nums">{overflow}</span> more</span>
              <span className="hidden group-open/details:inline">hide <span className="text-neutral-200 tabular-nums">{overflow}</span> more</span>
            </summary>
            <ul>
              {rest.map((s, i) => renderRow(s, i === rest.length - 1))}
            </ul>
          </details>
        </li>
      )}
    </ul>
  );
}
