import Link from 'next/link';
import { relativeTime } from '@/lib/format';
import type { stats } from '@/lib/db/queries';

interface ReceiptsProps {
  s: Awaited<ReturnType<typeof stats>> | null;
}

export function Receipts({ s }: ReceiptsProps) {
  const lastIngest = s?.lastIngestAt ? relativeTime(s.lastIngestAt) : 'daily';

  return (
    <section className="border-t border-neutral-900">
      <div className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="reveal">
          <p className="text-sm text-neutral-500 mb-3">Receipts</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50 max-w-2xl">
            Why trust this.
          </h2>
          <p className="text-neutral-300 mt-4 max-w-xl leading-relaxed">
            No funnel, no VC, no dark pattern. Everything load-bearing is public and verifiable.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 reveal reveal-delay-1">
          <Row
            label="data"
            value="arkadiyt/bounty-targets-data + Immunefi scrape"
            desc="Public upstream mirror of five platforms, plus a direct Immunefi scrape. One canonical source, no scraping of individual platforms."
            href="https://github.com/arkadiyt/bounty-targets-data"
            external
          />
          <Row
            label="scoring"
            value="/how-scored"
            desc="The 0–100 opportunity score formula is published in full. Payout (55) + bounty (20) + freshness (25). No opaque tiers."
            href="/how-scored"
          />
          <Row
            label="freshness"
            value={`ingested ${lastIngest}`}
            desc="Daily snapshot cadence. Scope and reward changes diffed into history — see /whats-new and /reward-changes for the live log."
            href="/whats-new"
          />
          <Row
            label="privacy"
            value="no email, no tracking cookies, no ads"
            desc="Sign-in is optional (GitHub, used only to sync watchlist across devices). Vercel Analytics is anonymous pageview counts, that's it."
            href="/how-it-works"
          />
        </div>

        <div className="mt-16 border border-neutral-900 rounded-2xl bg-neutral-950/40 p-6 md:p-8 reveal reveal-delay-2">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-sm text-emerald-300 mb-2">Who runs this</p>
              <p className="text-neutral-200 leading-relaxed">
                Built and maintained by{' '}
                <a
                  href="https://github.com/Varun2024"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 hover:text-emerald-200 transition underline underline-offset-4 decoration-emerald-400/30 hover:decoration-emerald-300"
                >
                  Varun
                </a>
                . Solo, no team, no funding. If something&rsquo;s broken, missing, or wrong,{' '}
                <a
                  href="https://github.com/Varun2024/Bounty-index/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 hover:text-emerald-200 transition underline underline-offset-4 decoration-emerald-400/30 hover:decoration-emerald-300"
                >
                  open an issue
                </a>{' '}
                — I actually read them.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <a
                href="https://github.com/Varun2024/Bounty-index"
                target="_blank"
                rel="noreferrer"
                className="focus-ring mono text-xs px-3 py-2 border border-neutral-800 bg-neutral-950/60 rounded-md text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900 transition inline-flex items-center gap-2"
                title="Source code on GitHub"
              >
                <span aria-hidden>★</span>
                source on github
              </a>
              <Link
                href="/mcp"
                className="focus-ring mono text-xs px-3 py-2 border border-neutral-800 bg-neutral-950/60 rounded-md text-neutral-300 hover:border-neutral-600 hover:bg-neutral-900 transition"
              >
                MCP server →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface RowProps {
  label: string;
  value: string;
  desc: string;
  href: string;
  external?: boolean;
}

function Row({ label, value, desc, href, external }: RowProps) {
  const inner = (
    <div className="border border-neutral-900 rounded-xl bg-neutral-950/40 hover:border-neutral-800 transition group p-6 h-full">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <span className="text-xs text-neutral-400">{label}</span>
        <span className="mono text-[11px] text-emerald-300 group-hover:text-emerald-200 transition truncate">
          {value}
        </span>
      </div>
      <p className="text-sm text-neutral-400 leading-relaxed">{desc}</p>
    </div>
  );
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className="focus-ring rounded-xl">
      {inner}
    </a>
  ) : (
    <Link href={href} className="focus-ring rounded-xl">
      {inner}
    </Link>
  );
}
