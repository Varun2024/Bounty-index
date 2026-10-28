import Link from 'next/link';
import type { getRecentChanges, trendingNewPayouts } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META, relativeTime } from '@/lib/format';

interface PulseProps {
  changes: Awaited<ReturnType<typeof getRecentChanges>>;
  trending: Awaited<ReturnType<typeof trendingNewPayouts>>;
}

// "What's moving now": the scope-churn feed leads (the product's whole point is that
// scope moves), with top new payouts as the money panel. Both panels are capped to a
// handful of 2-line rows so the columns stay roughly even and the section doesn't turn
// into a long scroll; each panel links out to its full list.
export function Pulse({ changes, trending }: PulseProps) {
  if (changes.length === 0 && trending.length === 0) return null;
  return (
    <section className="max-w-[1200px] mx-auto px-6 py-24">
      <div className="mb-12 reveal">
        <p className="text-sm text-neutral-500 mb-2">Pulse</p>
        <h2 className="text-3xl md:text-4xl font-semibold text-neutral-50 tracking-tight">What&apos;s moving now.</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">
        <PulsePanel
          eyebrow="Scope moved"
          hint="last 7 days"
          empty="No scope or reward changes in the last 7 days."
          footer={changes.length > 0 ? { href: '/whats-new', label: 'all changes' } : undefined}
        >
          {changes.map((c) => (
            <ChangeRow key={`${c.program.id}-${c.capturedAt.getTime()}`} c={c} />
          ))}
        </PulsePanel>

        <PulsePanel
          eyebrow="Top new payouts"
          hint="last 30 days"
          empty="No paying programs added recently."
          footer={trending.length > 0 ? { href: '/programs?sort=reward', label: 'full leaderboard' } : undefined}
        >
          {trending.map((p) => (
            <TrendingRow key={p.id} p={p} />
          ))}
        </PulsePanel>
      </div>
    </section>
  );
}

interface PulsePanelProps {
  eyebrow: string;
  hint: string;
  empty: string;
  footer?: { href: string; label: string };
  children: React.ReactNode;
}

function PulsePanel({ eyebrow, hint, empty, footer, children }: PulsePanelProps) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  const isEmpty = items.length === 0;
  return (
    <div className="border border-neutral-900 rounded-xl bg-neutral-950/50 overflow-hidden reveal reveal-delay-1">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-900 bg-neutral-950/70">
        <p className="text-xs text-emerald-300">{eyebrow}</p>
        <p className="text-xs text-neutral-500">{hint}</p>
      </div>
      {isEmpty ? (
        <div className="p-6 mono text-xs text-neutral-600">{empty}</div>
      ) : (
        <ul>{children}</ul>
      )}
      {!isEmpty && footer && (
        <Link
          href={footer.href}
          className="cta-arrow flex items-center justify-between px-5 py-2.5 border-t border-neutral-900 mono text-xs text-neutral-500 hover:text-emerald-400 hover:bg-neutral-900/30 transition focus-ring"
        >
          {footer.label} <span className="arrow">→</span>
        </Link>
      )}
    </div>
  );
}

// Two-line row (name + time, then a single meta line) so a change row is the same height
// as a payout row and the two columns line up.
function ChangeRow({ c }: { c: Awaited<ReturnType<typeof getRecentChanges>>[number] }) {
  const dot = PLATFORM_META[c.program.platform]?.dot ?? 'bg-neutral-500';
  return (
    <li className="border-b border-neutral-900 last:border-b-0">
      <Link
        href={`/programs/${c.program.platform}/${c.program.slug}`}
        className="flex items-start gap-4 px-5 py-3.5 hover:bg-neutral-900/40 transition group"
      >
        <span className={`w-1.5 h-1.5 mt-2 rounded-full ${dot} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-neutral-100 group-hover:text-emerald-400 transition truncate">{c.program.name}</p>
            <span className="text-xs text-neutral-500 shrink-0">{relativeTime(c.capturedAt)}</span>
          </div>
          <p className="mono text-[11px] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-neutral-500">{platformLabel(c.program.platform)}</span>
            {diffBits(c.diff)}
          </p>
        </div>
      </Link>
    </li>
  );
}

// Compact diff tokens for one line: counts and deltas only (identifier samples live on the
// program page and /whats-new).
function diffBits(diff: Awaited<ReturnType<typeof getRecentChanges>>[number]['diff']): React.ReactNode[] {
  const bits: React.ReactNode[] = [];
  if (diff.added.length) bits.push(<span key="a" className="text-emerald-300">+{diff.added.length} in-scope</span>);
  if (diff.removed.length) bits.push(<span key="r" className="text-amber-300">−{diff.removed.length} removed</span>);
  if (diff.rewardDelta) {
    bits.push(
      <span key="rw" className="text-neutral-300">
        reward {fmtReward(diff.rewardDelta.from)} → {fmtReward(diff.rewardDelta.to)}
      </span>,
    );
  }
  if (diff.safeHarborChanged) {
    bits.push(
      <span key="sh" className="text-neutral-300">
        safe-harbor {diff.safeHarborChanged.from ?? '—'} → {diff.safeHarborChanged.to ?? '—'}
      </span>,
    );
  }
  return bits;
}

function fmtReward(v: number | null): string {
  if (v === null) return '—';
  return formatBounty(v, 'USD');
}

function TrendingRow({ p }: { p: Awaited<ReturnType<typeof trendingNewPayouts>>[number] }) {
  const dot = PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500';
  return (
    <li className="border-b border-neutral-900 last:border-b-0">
      <Link
        href={`/programs/${p.platform}/${p.slug}`}
        className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-900/40 transition group"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-neutral-100 group-hover:text-emerald-400 transition truncate">{p.name}</p>
          <p className="mono text-[11px] text-neutral-500 mt-0.5 truncate">
            {platformLabel(p.platform)}
            {p.offersBounty ? <span className="text-emerald-400/80"> · bounty</span> : <span className="text-neutral-600"> · vdp</span>}
          </p>
        </div>
        {p.maxBounty ? (
          <span className="mono text-sm text-emerald-300 tabular-nums shrink-0">
            {formatBounty(p.maxBounty, p.currency ?? 'USD')}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
