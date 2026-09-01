import Link from 'next/link';
import { recentlyAdded, trendingNewPayouts } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META, relativeTime } from '@/lib/format';

interface PulseProps {
  recent: Awaited<ReturnType<typeof recentlyAdded>>;
  trending: Awaited<ReturnType<typeof trendingNewPayouts>>;
}

export function Pulse({ recent, trending }: PulseProps) {
  if (recent.length === 0 && trending.length === 0) return null;
  return (
    <section className="max-w-[1200px] mx-auto px-6 py-24">
      <div className="mb-12 flex items-end justify-between reveal">
        <div>
          <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">§ 03 · Pulse</p>
          <h2 className="text-3xl md:text-4xl font-semibold text-neutral-50 tracking-tight">What&apos;s moving now.</h2>
        </div>
        <Link
          href="/feed"
          className="hidden md:inline-flex cta-arrow mono text-xs text-neutral-500 hover:text-emerald-400 transition items-center gap-1.5"
        >
          full feed <span className="arrow">→</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 md:gap-8 items-start">
        <PulsePanel
          eyebrow="Recently added"
          hint="last 14 days"
          empty="No new programs indexed in the last 14 days."
        >
          {recent.map((p) => (
            <PulseRow key={p.id} p={p} showRelative />
          ))}
        </PulsePanel>

        <PulsePanel
          eyebrow="Top new payouts"
          hint="last 30 days"
          empty="No paying programs added recently."
        >
          {trending.map((p) => (
            <PulseRow key={p.id} p={p} showPayout />
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
  children: React.ReactNode;
}

function PulsePanel({ eyebrow, hint, empty, children }: PulsePanelProps) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div className="border border-neutral-900 rounded-xl bg-neutral-950/50 overflow-hidden reveal reveal-delay-1">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-900 bg-neutral-950/70">
        <p className="mono text-[10px] uppercase tracking-widest text-emerald-400">{eyebrow}</p>
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-600">{hint}</p>
      </div>
      {items.length === 0 ? (
        <div className="p-6 mono text-xs text-neutral-600">— {empty} —</div>
      ) : (
        <ul>{children}</ul>
      )}
    </div>
  );
}

interface PulseRowProps {
  p: Awaited<ReturnType<typeof recentlyAdded>>[number];
  showRelative?: boolean;
  showPayout?: boolean;
}

function PulseRow({ p, showRelative, showPayout }: PulseRowProps) {
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
        {showPayout && p.maxBounty ? (
          <span className="mono text-sm text-emerald-300 tabular-nums shrink-0">
            {formatBounty(p.maxBounty, p.currency ?? 'USD')}
          </span>
        ) : showRelative && p.firstSeenAt ? (
          <span className="mono text-[10px] uppercase tracking-widest text-neutral-500 shrink-0">
            {relativeTime(p.firstSeenAt)}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
