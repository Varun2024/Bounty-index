// At-a-glance honest signals for a program. These replace a single predictive "score" as the
// first read: a payout tier from the STATED max bounty, a cash-vs-VDP tag, and a fresh/new flag.
// Every badge maps to one real field, so nothing here implies an expected payout.

type DateLike = Date | string | null | undefined;

interface ProgramBadgesProps {
  maxBounty: number | null;
  offersBounty: boolean;
  lastUpdatedAt: DateLike;
  firstSeenAt?: DateLike;
  size?: 'sm' | 'md';
}

// Stated-ceiling tiers. A program only earns a tier when it both pays cash and exposes a figure;
// HackerOne pays but publishes no program-level number, so those stay tier-less (the cash tag
// still shows). Thresholds are the stated max, never an observed payout.
const PAYOUT_TIERS: { min: number; label: string }[] = [
  { min: 50_000, label: '$$$' },
  { min: 5_000, label: '$$' },
  { min: 1, label: '$' },
];

const FRESH_DAYS = 30;
const DAY_MS = 86_400_000;

function daysSince(d: DateLike, now: number): number | null {
  if (!d) return null;
  const ts = typeof d === 'string' ? Date.parse(d) : d.getTime();
  if (!Number.isFinite(ts)) return null;
  return (now - ts) / DAY_MS;
}

function payoutTier(maxBounty: number | null): string | null {
  if (!maxBounty || maxBounty <= 0) return null;
  return PAYOUT_TIERS.find((t) => maxBounty >= t.min)?.label ?? null;
}

// Time-dependent resolution lives in a plain function so the component body stays pure
// (react-hooks/purity). Mirrors how lib/opportunity.ts isolates `now`.
interface ResolvedBadges {
  tier: string | null;
  flag: 'new' | 'fresh' | null;
}

function resolveBadges(p: ProgramBadgesProps, now: number = Date.now()): ResolvedBadges {
  const tier = p.offersBounty ? payoutTier(p.maxBounty) : null;
  const newAge = daysSince(p.firstSeenAt, now);
  const freshAge = daysSince(p.lastUpdatedAt, now);
  const isNew = newAge !== null && newAge <= FRESH_DAYS;
  const isFresh = !isNew && freshAge !== null && freshAge <= FRESH_DAYS;
  return { tier, flag: isNew ? 'new' : isFresh ? 'fresh' : null };
}

export function ProgramBadges(props: ProgramBadgesProps) {
  const { offersBounty, size = 'sm' } = props;
  const { tier, flag } = resolveBadges(props);

  const pad = size === 'md' ? 'px-2 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[10px]';
  const base = `mono uppercase tracking-widest rounded border ${pad}`;

  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      {tier && (
        <span className={`${base} text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.06]`} title="Stated max-bounty tier">
          {tier}
        </span>
      )}
      <span
        className={
          offersBounty
            ? `${base} text-emerald-300 border-emerald-400/30 bg-emerald-400/[0.06]`
            : `${base} text-neutral-400 border-neutral-800 bg-neutral-900/50`
        }
        title={offersBounty ? 'Pays cash bounties' : 'Disclosure only, no cash reward'}
      >
        {offersBounty ? 'cash' : 'vdp'}
      </span>
      {flag && (
        <span
          className={`${base} text-sky-300 border-sky-400/30 bg-sky-400/[0.06]`}
          title={flag === 'new' ? `First indexed within ${FRESH_DAYS} days` : `Updated within ${FRESH_DAYS} days`}
        >
          {flag}
        </span>
      )}
    </div>
  );
}
