import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProgramBySlug } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META, relativeTime, scopeHref } from '@/lib/format';
import { ExternalIcon } from '@/app/_ui/icons';
import { CompareButton } from '@/app/_ui/compare-button';

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
  const bounty = program.maxBounty ? ` — up to $${program.maxBounty.toLocaleString()}` : '';
  const title = `${program.name} · ${program.platform}${bounty}`;
  const inScopeCount = scopes.filter((s) => s.inScope).length;
  const description = `${program.name} on ${program.platform}. ${inScopeCount} in-scope assets. Program type: ${program.programType}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `/programs/${program.platform}/${program.slug}` },
  };
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const { platform, slug } = await params;
  const fullSlug = slug.join('/');
  const result = await getProgramBySlug(platform, fullSlug);
  if (!result) notFound();
  const { program, scopes } = result;
  const inScope = scopes.filter((s) => s.inScope);
  const outOfScope = scopes.filter((s) => !s.inScope);
  const platformDot = PLATFORM_META[program.platform]?.dot ?? 'bg-neutral-500';

  return (
    <div className="relative">
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
            <div className="min-w-0">
              <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-neutral-50 break-words">{program.name}</h1>
              <div className="mt-3 mono text-xs text-neutral-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${platformDot}`} />
                  {platformLabel(program.platform)}
                </span>
                <span className="text-neutral-700">·</span>
                {program.maxBounty ? (
                  <>
                    <span className="text-emerald-300">payout up to {formatBounty(program.maxBounty, program.currency ?? 'USD')}</span>
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
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
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

function ScopeColumn({ kind, items }: ScopeColumnProps) {
  const isIn = kind === 'in';
  const glyph = isIn ? '+' : '−';
  const glyphColor = isIn ? 'text-emerald-400' : 'text-neutral-600';
  const title = isIn ? 'In scope' : 'Out of scope';

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="mono text-[10px] uppercase tracking-widest text-neutral-500">{title}</h2>
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">{items.length.toString().padStart(3, '0')}</span>
      </div>
      {items.length === 0 ? (
        <p className="mono text-xs text-neutral-600 py-6">— none listed —</p>
      ) : (
        <ul className={`border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40 ${isIn ? '' : 'opacity-80'}`}>
          {items.map((s, i) => {
            const href = scopeHref(s.identifier);
            const rowClass = `flex items-center gap-3 px-4 py-3 md:py-2.5 ${i === items.length - 1 ? '' : 'border-b border-neutral-900'} hover:bg-neutral-900/40 active:bg-neutral-900/60 transition group`;
            const body = (
              <>
                <span className={`mono text-sm ${glyphColor} shrink-0 w-3`}>{glyph}</span>
                <code className={`mono text-xs break-all flex-1 ${href ? 'text-neutral-200 group-hover:text-emerald-300' : 'text-neutral-300'}`}>
                  {s.identifier}
                </code>
                {href && (
                  <ExternalIcon size={10} className="text-neutral-700 group-hover:text-emerald-400 shrink-0 transition" />
                )}
                <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 shrink-0">{s.assetType}</span>
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
          })}
        </ul>
      )}
    </section>
  );
}
