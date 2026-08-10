import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProgramBySlug, getProgramSnapshots, type ProgramSnapshot } from '@/lib/db/queries';
import { getNote } from '@/app/actions/notes';
import { getUserReport, getProgramReportStats } from '@/app/actions/reports';
import { formatPayoutRange, platformLabel, PLATFORM_META, relativeTime } from '@/lib/format';
import { summarizeActivity } from '@/lib/snapshots';
import { extractCompanyDomain } from '@/lib/program-domain';
import { ExternalIcon } from '@/app/_ui/icons';
import { CompareButton } from '@/app/_ui/compare-button';
import { WatchButton } from '@/app/_ui/watch-button';
import { PlatformLogo } from '@/app/_ui/platform-logo';
import { CompanyLogo } from '@/app/_ui/company-logo';
import { ProgramNotes } from '@/app/_ui/program-notes';
import { CommunityReports } from '@/app/_ui/community-reports';
import { ScopeColumn, Tag } from './scope-columns';
import { ProgramTimeline } from './timeline';

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

