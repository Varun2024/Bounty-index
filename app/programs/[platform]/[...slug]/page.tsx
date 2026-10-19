import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProgramBySlug, getProgramSnapshots, getSimilarPrograms, getProgramReportStats, type ProgramSnapshot, type SimilarProgram } from '@/lib/db/queries';
import { formatPayoutRange, platformLabel, PLATFORM_META, relativeTime } from '@/lib/format';
import { summarizeActivity } from '@/lib/snapshots';
import { extractCompanyDomain } from '@/lib/program-domain';
import { ExternalIcon, RssIcon } from '@/app/_ui/icons';
import { SectionHeading } from '@/app/_ui/section-heading';
import { CompareButton } from '@/app/_ui/compare-button';
import { WatchButton } from '@/app/_ui/watch-button';
import { PlatformLogo } from '@/app/_ui/platform-logo';
import { CompanyLogo } from '@/app/_ui/company-logo';
import { ProgramNotes } from '@/app/_ui/program-notes';
import { CommunityReports } from '@/app/_ui/community-reports';
import { ScopeColumn, Tag } from './scope-columns';
import { ProgramTimeline } from './timeline';
import { OpportunityBreakdown } from './opportunity-breakdown';
import { ScopeMixBar } from './scope-mix-bar';
import { RecentChanges } from './recent-changes';
import { SimilarPrograms } from './similar-programs';
import { CopyScope } from './copy-scope';
import { SectionNav } from './section-nav';

// ISR: program data changes once a day via ingest. Serve the shell from CDN for an hour.
// Per-user bits (note, user's own report) are fetched client-side inside their components;
// they never land in the cached HTML. Global report stats are cacheable so they stay here.
export const revalidate = 86400;

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
  // ponytail: only cacheable (program-global) data runs server-side under ISR. Per-user bits
  // (note, user's own report) are hydrated client-side inside ProgramNotes / CommunityReports
  // so we never bake one viewer's state into another viewer's cached HTML.
  const [snapshots, initialReportStats, similar] = await Promise.all([
    getProgramSnapshots(program.id).catch(() => [] as ProgramSnapshot[]),
    getProgramReportStats(program.id).catch(() => ({ count: 0, waitingCount: 0, medianFirstResponseDays: null })),
    getSimilarPrograms(program.id, 5).catch(() => [] as SimilarProgram[]),
  ]);
  const initialNote = { content: '', updatedAt: null };
  const initialUserReport = null;
  const inScope = scopes.filter((s) => s.inScope);
  const outOfScope = scopes.filter((s) => !s.inScope);
  const platformDot = PLATFORM_META[program.platform]?.dot ?? 'bg-neutral-500';
  const payout = formatPayoutRange(program.minBounty, program.maxBounty, program.currency ?? 'USD');
  const companyDomain = extractCompanyDomain(scopes, program.name);
  const activity = summarizeActivity(snapshots, 7);
  const hasActivity = activity.hasBaseline && (activity.addedCount > 0 || activity.removedCount > 0 || activity.rewardChanged);

  // Asset-type mix + last change: derived, no DB.
  const mixBuckets = new Map<string, number>();
  for (const s of inScope) mixBuckets.set(s.assetType, (mixBuckets.get(s.assetType) ?? 0) + 1);
  const assetTypeMix = [...mixBuckets.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const inScopeIdentifiers = inScope.map((s) => s.identifier);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bountyindex.in';
  const encodedSlug = program.slug.split('/').map(encodeURIComponent).join('/');
  const encodedPlatform = encodeURIComponent(program.platform);
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Programs', item: `${siteUrl}/programs` },
      { '@type': 'ListItem', position: 2, name: platformLabel(program.platform), item: `${siteUrl}/platforms/${encodedPlatform}` },
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
          <Link href={`/platforms/${program.platform}`} className="text-neutral-500 hover:text-neutral-300 transition inline-flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${platformDot}`} />
            {platformLabel(program.platform)}
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-emerald-400 truncate">{program.slug}</span>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-10">
        {/* Hero: identity on the left, a compact key-facts card + primary CTA on the right. */}
        <section className="border-b border-neutral-900 pb-8 reveal">
          <div className="grid lg:grid-cols-[1fr_300px] gap-6 lg:gap-10 items-start">
            {/* Identity */}
            <div className="min-w-0">
              <div className="flex items-start gap-4">
                <CompanyLogo domain={companyDomain} name={program.name} size={48} className="mt-1 shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-neutral-50 break-words">{program.name}</h1>
                  <div className="mt-3 mono text-xs text-neutral-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-2">
                      <PlatformLogo platform={program.platform} size="sm" />
                      {platformLabel(program.platform)}
                    </span>
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
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 mono text-[11px]">
                <Tag active={program.offersBounty}>{program.programType}</Tag>
                {program.offersSwag && <Tag>swag</Tag>}
                {program.managed && <Tag>managed</Tag>}
                {program.submissionState && <Tag>{program.submissionState}</Tag>}
                {program.handle && program.handle !== program.slug && <Tag>@{program.handle}</Tag>}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <WatchButton programId={program.id} />
                <CompareButton programId={program.id} />
                <Link
                  href={`/settings/discord?program=${program.id}`}
                  className="focus-ring mono text-xs px-3 py-2 border border-neutral-800 rounded-md text-neutral-400 hover:text-emerald-400 hover:border-neutral-600 transition inline-flex items-center gap-1.5"
                  title="One webhook, this program, forever. Zero emails, because we don't have yours."
                >
                  Discord →
                </Link>
                <a
                  href={`/rss/programs/${program.platform}/${program.slug}`}
                  className="focus-ring mono text-xs px-3 py-2 border border-neutral-800 rounded-md text-neutral-400 hover:text-emerald-400 hover:border-neutral-600 transition inline-flex items-center gap-1.5"
                  title="RSS feed of this program's scope and reward changes"
                >
                  <RssIcon size={12} /> RSS
                </a>
              </div>
            </div>

            {/* Key facts */}
            <div className="w-full">
              <dl className="rounded-xl border border-neutral-900 bg-neutral-950/60 divide-y divide-neutral-900 overflow-hidden">
                <KeyFact label="payout">
                  {payout ? (
                    <span className="text-emerald-300">{payout.value}</span>
                  ) : (
                    <span className="text-neutral-600">no bounty</span>
                  )}
                </KeyFact>
                <KeyFact label="scope">
                  <span className="text-neutral-200">{inScope.length} in</span>
                  <span className="text-neutral-600"> · {outOfScope.length} out</span>
                </KeyFact>
                <KeyFact label="safe harbor">
                  <SafeHarborValue value={program.safeHarbor} />
                </KeyFact>
                <KeyFact label="response">
                  {initialReportStats.medianFirstResponseDays === null ? (
                    <span className="text-neutral-600">no reports</span>
                  ) : (
                    <>
                      <span className="text-neutral-200">{formatResponseDays(initialReportStats.medianFirstResponseDays)}</span>
                      <span className="text-neutral-500"> median</span>
                    </>
                  )}
                </KeyFact>
              </dl>
              <a
                href={program.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 w-full focus-ring cta-arrow mono text-sm px-4 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition shadow-[0_0_40px_-10px] shadow-emerald-400/70 inline-flex items-center justify-center gap-2"
              >
                open program <ExternalIcon size={12} className="arrow" />
              </a>
            </div>
          </div>
        </section>

        <SectionNav />

        <OpportunityBreakdown
          program={{
            maxBounty: program.maxBounty,
            offersBounty: program.offersBounty,
            lastUpdatedAt: program.lastUpdatedAt,
          }}
        />

        <ScopeMixBar mix={assetTypeMix} />

        {/* Scope: split columns */}
        <div id="scope" className="mt-10 scroll-mt-28 reveal reveal-delay-1">
          <SectionHeading title="Scope" variant="prominent">
            <CopyScope identifiers={inScopeIdentifiers} />
          </SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ScopeColumn kind="in" items={inScope} />
            <ScopeColumn kind="out" items={outOfScope} />
          </div>
        </div>

        <div id="changes" className="scroll-mt-28">
          <RecentChanges snapshots={snapshots} currency={program.currency ?? 'USD'} />
        </div>

        <div id="community" className="scroll-mt-28">
          <CommunityReports
            programId={program.id}
            programName={program.name}
            initialStats={initialReportStats}
            initialUserReport={initialUserReport}
          />
        </div>

        <SimilarPrograms items={similar} />

        <div id="notes" className="scroll-mt-28">
          <ProgramNotes programId={program.id} initialNote={initialNote} />
        </div>

        <ProgramTimeline snapshots={snapshots} currency={program.currency ?? 'USD'} />

        {program.raw != null && (
          <details className="mt-10 group">
            <summary className="mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-emerald-300 transition cursor-pointer list-none">
              <span className="text-neutral-700 group-open:hidden">▸</span>
              <span className="text-neutral-700 hidden group-open:inline">▾</span>{' '}
              raw source payload
            </summary>
            <pre className="mt-3 mono text-[11px] text-neutral-400 bg-neutral-950/60 border border-neutral-900 rounded-lg p-4 overflow-x-auto max-h-[520px]">
              {JSON.stringify(program.raw, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// One row in the key-facts card: muted label on the left, value on the right.
function KeyFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <dt className="mono text-[10px] uppercase tracking-widest text-neutral-500 shrink-0">{label}</dt>
      <dd className="mono text-sm text-right tabular-nums truncate">{children}</dd>
    </div>
  );
}

// Safe harbor (legal protection for good-faith research) is a top decision signal, so it gets
// a color. Null means the platform doesn't publish it structurally yet.
function SafeHarborValue({ value }: { value: string | null }) {
  if (!value) return <span className="text-neutral-600">unknown</span>;
  const tone = value === 'full' ? 'text-emerald-300' : value === 'partial' ? 'text-amber-300' : 'text-red-400';
  return <span className={tone}>{value}</span>;
}

function formatResponseDays(d: number): string {
  if (d < 1) return '<1d';
  if (d < 10) return `${d.toFixed(1)}d`;
  return `${Math.round(d)}d`;
}

