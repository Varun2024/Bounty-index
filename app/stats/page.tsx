import type { Metadata } from 'next';
import Link from 'next/link';
import { stats, topPayouts } from '@/lib/db/queries';
import { formatBounty, platformLabel } from '@/lib/format';
import { datasetLd, faqLd, jsonLdScript, type FaqItem } from '@/lib/structured-data';

// ISR: these are aggregate numbers over data that only moves at the daily ingest.
export const revalidate = 3600;

const PLATFORMS = ['HackerOne', 'Bugcrowd', 'Intigriti', 'YesWeHack', 'Immunefi', 'HackenProof', 'Federacy'];

function asOf(d: Date | null): string {
  if (!d) return 'the latest ingest';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await stats().catch(() => null);
  const count = s ? s.programs.toLocaleString() : '';
  return {
    title: 'Bug Bounty Statistics — bounty.index',
    description: s
      ? `${count} public bug bounty programs across ${s.platforms} platforms, ${s.bountyPrograms.toLocaleString()} paying cash. Live aggregate stats, updated daily.`
      : 'Live aggregate statistics on public bug bounty programs across every major platform, updated daily.',
    alternates: { canonical: '/stats' },
  };
}

export default async function StatsPage() {
  const [s, top] = await Promise.all([stats().catch(() => null), topPayouts(5).catch(() => [])]);

  if (!s) {
    return (
      <div className="max-w-[900px] mx-auto px-6 py-24">
        <h1 className="text-3xl font-semibold text-neutral-100">Bug bounty statistics</h1>
        <p className="mt-4 text-neutral-400">Stats are temporarily unavailable. Try again shortly.</p>
      </div>
    );
  }

  const highest = top[0] ?? null;
  const date = asOf(s.lastIngestAt);
  const nonBounty = s.programs - s.bountyPrograms;

  // FAQ grounded entirely in the live numbers above — no fabricated figures.
  const faqs: FaqItem[] = [
    {
      question: 'How many public bug bounty programs are there?',
      answer:
        `As of ${date}, bounty.index tracks ${s.programs.toLocaleString()} public programs across ` +
        `${s.platforms} platforms. Of these, ${s.bountyPrograms.toLocaleString()} pay cash rewards and ` +
        `${nonBounty.toLocaleString()} are vulnerability disclosure programs (no cash reward).`,
    },
    {
      question: 'Which platforms does bounty.index cover?',
      answer: `${PLATFORMS.join(', ')} — ${s.platforms} platforms in total, aggregated into one searchable index and updated daily.`,
    },
    ...(highest
      ? [{
          question: 'What is the highest-paying bug bounty program right now?',
          answer:
            `The highest live maximum payout is ${highest.name} on ${platformLabel(highest.platform)}, ` +
            `paying up to ${formatBounty(highest.maxBounty, highest.currency ?? 'USD')}.`,
        }]
      : []),
    {
      question: 'How many in-scope assets do these programs cover?',
      answer:
        `${s.inScopeAssets.toLocaleString()} in-scope assets (domains, wildcards, APIs, mobile apps, ` +
        `source repositories, and more) across all tracked programs, as of ${date}.`,
    },
    {
      question: 'How often is the data updated, and is it free?',
      answer:
        `The index is rebuilt daily (last update: ${date}). All data is free to browse, filter, export as ` +
        `CSV/JSON, and query via a public MCP endpoint for AI agents — no signup required.`,
    },
  ];

  const bulletStats: { label: string; value: string }[] = [
    { label: 'public programs', value: s.programs.toLocaleString() },
    { label: 'paying cash rewards', value: s.bountyPrograms.toLocaleString() },
    { label: 'in-scope assets', value: s.inScopeAssets.toLocaleString() },
    { label: 'platforms indexed', value: String(s.platforms) },
  ];

  return (
    <div className="max-w-[900px] mx-auto px-6 py-16 md:py-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(datasetLd(s)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqLd(faqs)) }} />

      <header>
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Live aggregate</p>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-neutral-50 leading-[1.03]">
          Bug bounty statistics
        </h1>
        {/* Lead sentence is the answer, in prose, so answer engines can lift it directly. */}
        <p className="mt-6 text-lg text-neutral-300 leading-relaxed max-w-2xl">
          As of {date}, there are{' '}
          <span className="text-neutral-50 tabular-nums mono">{s.programs.toLocaleString()}</span> public bug bounty
          and vulnerability disclosure programs across{' '}
          <span className="text-neutral-50 tabular-nums mono">{s.platforms}</span> platforms.{' '}
          <span className="text-emerald-300 tabular-nums mono">{s.bountyPrograms.toLocaleString()}</span> pay cash
          rewards, spanning{' '}
          <span className="text-neutral-50 tabular-nums mono">{s.inScopeAssets.toLocaleString()}</span> in-scope assets.
          {highest && (
            <>
              {' '}The highest live payout is{' '}
              <Link href={`/programs/${highest.platform}/${highest.slug}`} className="text-emerald-300 hover:text-emerald-200 transition underline decoration-emerald-400/30 underline-offset-4">
                {highest.name}
              </Link>{' '}
              at up to{' '}
              <span className="text-neutral-50 tabular-nums mono">{formatBounty(highest.maxBounty, highest.currency ?? 'USD')}</span>.
            </>
          )}
        </p>
      </header>

      <dl className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-8">
        {bulletStats.map((st) => (
          <div key={st.label}>
            <dd className="mono tabular-nums text-3xl md:text-4xl font-medium text-neutral-50">{st.value}</dd>
            <dt className="mt-1 text-xs text-neutral-400">{st.label}</dt>
          </div>
        ))}
      </dl>

      {top.length > 0 && (
        <section className="mt-16">
          <h2 className="text-sm text-neutral-400 mb-4">Highest live payouts</h2>
          <ol className="divide-y divide-neutral-900 border-y border-neutral-900">
            {top.slice(0, 5).map((p, i) => (
              <li key={p.id}>
                <Link
                  href={`/programs/${p.platform}/${p.slug}`}
                  className="flex items-center gap-4 py-3 group focus-ring rounded-md -mx-2 px-2 hover:bg-neutral-900/40 transition"
                >
                  <span className="mono text-xs text-neutral-600 tabular-nums w-5">{i + 1}</span>
                  <span className="flex-1 min-w-0 text-sm text-neutral-100 truncate group-hover:text-emerald-300 transition">
                    {p.name}
                    <span className="text-neutral-500"> · {platformLabel(p.platform)}</span>
                  </span>
                  <span className="mono text-sm text-neutral-100 shrink-0 tabular-nums">
                    up to {formatBounty(p.maxBounty, p.currency ?? 'USD')}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-16">
        <h2 className="text-sm text-neutral-400 mb-5">Frequently asked</h2>
        <div className="space-y-6">
          {faqs.map((f) => (
            <div key={f.question}>
              <h3 className="text-base font-medium text-neutral-100">{f.question}</h3>
              <p className="mt-1.5 text-sm text-neutral-400 leading-relaxed">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-16 pt-6 border-t border-neutral-900 flex flex-wrap items-center gap-x-4 gap-y-2 mono text-xs text-neutral-500">
        <span className="inline-flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
          updated daily
        </span>
        <span className="text-neutral-800">·</span>
        <Link href="/programs" className="hover:text-emerald-300 transition">browse the index →</Link>
        <span className="text-neutral-800">·</span>
        <a href="/api/export/programs?format=csv" className="hover:text-emerald-300 transition">export CSV</a>
        <span className="text-neutral-800">·</span>
        <Link href="/mcp" className="hover:text-emerald-300 transition">MCP endpoint</Link>
      </div>
    </div>
  );
}
