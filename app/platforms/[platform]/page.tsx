import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listPrograms, stats } from '@/lib/db/queries';
import { formatBounty, PLATFORM_META, platformLabel } from '@/lib/format';
import { opportunityScore } from '@/lib/opportunity';

export const revalidate = 3600;

const PLATFORMS = ['hackerone', 'bugcrowd', 'intigriti', 'yeswehack', 'federacy', 'immunefi'] as const;
type PlatformId = typeof PLATFORMS[number];

interface PageProps {
  params: Promise<{ platform: string }>;
}

const BLURBS: Record<PlatformId, string> = {
  hackerone: 'HackerOne hosts the broadest set of public bug bounty programs, from enterprise SaaS to crypto exchanges. VDPs and paid programs sit side by side.',
  bugcrowd: 'Bugcrowd runs managed and standalone programs across SaaS, retail, government, and automotive. Known for strong triage support.',
  intigriti: 'Intigriti is Europe-first with heavy fintech, telco, and public-sector representation. Smaller catalog, denser safe-harbor language.',
  yeswehack: 'YesWeHack hosts programs weighted toward European enterprise, with notable crypto and gaming entries.',
  federacy: 'Federacy is the long-tail — smaller programs, early-stage startups, and public VDPs that often slip under the radar.',
  immunefi: 'Immunefi is the DeFi + web3 specialist. Catalog is 100% paid, often with multi-million-dollar maximum bounties on smart contracts and bridges.',
};

export function generateStaticParams() {
  return PLATFORMS.map((platform) => ({ platform }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { platform } = await params;
  if (!PLATFORMS.includes(platform as PlatformId)) return { title: 'Platform not found · Bounty Index' };
  const label = platformLabel(platform);
  const title = `${label} bug bounty programs — bounty.index`;
  const description = `Every public ${label} bug bounty program, filterable by scope, payout, and asset type. Daily snapshots, no login required.`;
  return {
    title,
    description,
    alternates: { canonical: `/platforms/${platform}` },
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function PlatformLandingPage({ params }: PageProps) {
  const { platform } = await params;
  if (!PLATFORMS.includes(platform as PlatformId)) notFound();
  const id = platform as PlatformId;
  const label = platformLabel(id);
  const dot = PLATFORM_META[id]?.dot ?? 'bg-neutral-500';

  // ponytail: listPrograms already returns `total` with the rows. Second count query dropped.
  const [top, s] = await Promise.all([
    listPrograms({ platform: [id], sort: 'opportunity', pageSize: 10 }).catch(() => ({ rows: [], total: 0 })),
    stats().catch(() => null),
  ]);

  const topPayouts = [...top.rows]
    .filter((r) => r.maxBounty !== null)
    .sort((a, b) => (b.maxBounty ?? 0) - (a.maxBounty ?? 0))
    .slice(0, 5);

  const sharePct = s && s.programs > 0 ? Math.round((top.total / s.programs) * 100) : null;

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      <header className="reveal">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
          <Link href="/programs" className="hover:text-neutral-300 transition">programs</Link>
          <span className="text-neutral-700"> / platforms / </span>
          <span className="text-neutral-300">{id}</span>
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-neutral-50">{label}</h1>
        </div>
        <p className="text-neutral-400 mt-4 max-w-2xl leading-relaxed">
          {BLURBS[id]}
        </p>
      </header>

      <section className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="programs" value={top.total.toLocaleString()} />
        <Stat
          label="share of index"
          value={sharePct === null ? '—' : `${sharePct}%`}
          sub={s ? `of ${s.programs.toLocaleString()}` : undefined}
        />
        <Stat label="top payout" value={topPayouts[0]?.maxBounty ? formatBounty(topPayouts[0].maxBounty, topPayouts[0].currency ?? 'USD') : '—'} />
        <Stat label="updated" value={s?.lastIngestAt ? 'daily' : '—'} sub="snapshot cadence" />
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between mb-4 gap-4">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-neutral-100 inline-flex items-center gap-3">
            <span aria-hidden className="w-1 h-5 bg-emerald-400 rounded-sm" />
            Top programs
          </h2>
          <Link
            href={`/programs?platform=${id}`}
            className="mono text-xs text-neutral-500 hover:text-emerald-300 transition"
          >
            all {top.total.toLocaleString()} →
          </Link>
        </div>
        {top.rows.length === 0 ? (
          <p className="mono text-xs text-neutral-600 py-6">— index unavailable right now —</p>
        ) : (
          <ul className="border border-neutral-900 rounded-lg bg-neutral-950/40 overflow-hidden">
            {top.rows.slice(0, 10).map((p, i) => {
              const score = opportunityScore(p).total;
              return (
                <li key={p.id} className={i === top.rows.length - 1 ? '' : 'border-b border-neutral-900'}>
                  <Link
                    href={`/programs/${p.platform}/${p.slug}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-neutral-900/50 transition group"
                  >
                    <span className="mono text-xs text-neutral-600 tabular-nums w-6">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1 min-w-0 truncate text-neutral-100 group-hover:text-emerald-300 transition">{p.name}</span>
                    <span className="mono text-xs text-neutral-400 tabular-nums shrink-0">
                      {formatBounty(p.maxBounty, p.currency ?? 'USD')}
                    </span>
                    <span className="mono text-[11px] text-emerald-400/80 tabular-nums shrink-0 w-10 text-right">
                      {score}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10 flex flex-wrap gap-3">
        <Link
          href={`/programs?platform=${id}&hasBounty=1`}
          className="mono text-sm px-4 py-2.5 border border-neutral-800 bg-neutral-950/60 rounded-md text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900 transition"
        >
          paying programs →
        </Link>
        <Link
          href={`/programs?platform=${id}&safeHarbor=1`}
          className="mono text-sm px-4 py-2.5 border border-neutral-800 bg-neutral-950/60 rounded-md text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900 transition"
        >
          safe-harbor only →
        </Link>
        <Link
          href={`/programs?platform=${id}&assetType=wildcard`}
          className="mono text-sm px-4 py-2.5 border border-neutral-800 bg-neutral-950/60 rounded-md text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900 transition"
        >
          wildcards →
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-neutral-900 rounded-lg bg-neutral-950/40 px-4 py-3">
      <div className="mono text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="mt-1 text-neutral-100 text-lg tabular-nums">{value}</div>
      {sub && (
        <div className="mono text-[10px] uppercase tracking-widest text-neutral-600 truncate">{sub}</div>
      )}
    </div>
  );
}
