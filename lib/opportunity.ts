// Opportunity score — a public, transparent 0-100 ranking for programs.
//
// v1 signals (all on the `programs` table, no schema changes):
//   1. payout       — log-scaled max_bounty, weight 55
//   2. bountyBonus  — 1 if program pays cash, 0 for VDP, weight 20
//   3. freshness    — 1 if updated within 30 days, decaying to 0 at 180+ days, weight 25
//
// v2 candidates (require denormalization): scope breadth (inScopeCount), median
// first-response time from user reports. Deferred until the columns exist on
// `programs` — computing them per row in a sort would kill pagination.
//
// ponytail: pure function + one SQL expression. No orm helper indirection.
// The formula lives in ONE place and is exposed publicly at /how-scored — that
// transparency is the moat vs bbradar's opaque tiers.

import { sql, type SQL } from 'drizzle-orm';
import { programs } from './db/schema';

export const WEIGHTS = { payout: 55, bounty: 20, freshness: 25 } as const;

const PAYOUT_FLOOR = 500;      // $500 max_bounty ~= 0 on the payout axis
const PAYOUT_CEIL = 250_000;   // $250k+ ~= 1 on the payout axis
const FRESH_FULL_DAYS = 30;    // updated within 30d → full freshness credit
const FRESH_ZERO_DAYS = 180;   // 180d+ old → zero freshness credit

export interface OpportunityBreakdown {
  total: number;
  payout: number;      // 0..WEIGHTS.payout
  bounty: number;      // 0 or WEIGHTS.bounty
  freshness: number;   // 0..WEIGHTS.freshness
}

interface ScoreInput {
  maxBounty: number | null;
  offersBounty: boolean;
  lastUpdatedAt: Date | null;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function payoutAxis(maxBounty: number | null): number {
  if (!maxBounty || maxBounty <= 0) return 0;
  // Log-scale between PAYOUT_FLOOR and PAYOUT_CEIL. $500 → 0, $250k → 1.
  const lnFloor = Math.log(PAYOUT_FLOOR);
  const lnCeil = Math.log(PAYOUT_CEIL);
  return clamp01((Math.log(maxBounty) - lnFloor) / (lnCeil - lnFloor));
}

function freshnessAxis(lastUpdatedAt: Date | null, now: Date = new Date()): number {
  if (!lastUpdatedAt) return 0;
  const days = (now.getTime() - lastUpdatedAt.getTime()) / 86_400_000;
  if (days <= FRESH_FULL_DAYS) return 1;
  if (days >= FRESH_ZERO_DAYS) return 0;
  return clamp01(1 - (days - FRESH_FULL_DAYS) / (FRESH_ZERO_DAYS - FRESH_FULL_DAYS));
}

export function opportunityScore(p: ScoreInput, now?: Date): OpportunityBreakdown {
  const payout = payoutAxis(p.maxBounty) * WEIGHTS.payout;
  const bounty = p.offersBounty ? WEIGHTS.bounty : 0;
  const freshness = freshnessAxis(p.lastUpdatedAt, now) * WEIGHTS.freshness;
  return { total: Math.round(payout + bounty + freshness), payout, bounty, freshness };
}

// SQL expression that yields the same score, for use in ORDER BY / SELECT.
// Kept in lockstep with the JS formula above — if you change one, change both.
export function opportunityScoreSql(): SQL<number> {
  const lnFloor = Math.log(PAYOUT_FLOOR);
  const lnCeil = Math.log(PAYOUT_CEIL);
  const span = lnCeil - lnFloor;
  return sql<number>`
    (
      ${WEIGHTS.payout} * LEAST(1.0, GREATEST(0.0,
        (LN(GREATEST(${programs.maxBounty}, 1)) - ${lnFloor}) / ${span}
      )) * (CASE WHEN ${programs.maxBounty} IS NULL OR ${programs.maxBounty} <= 0 THEN 0 ELSE 1 END)
      +
      ${WEIGHTS.bounty} * (CASE WHEN ${programs.offersBounty} THEN 1 ELSE 0 END)
      +
      ${WEIGHTS.freshness} * (CASE
        WHEN ${programs.lastUpdatedAt} IS NULL THEN 0
        ELSE GREATEST(0.0, LEAST(1.0,
          1.0 - (GREATEST(0, EXTRACT(EPOCH FROM (NOW() - ${programs.lastUpdatedAt})) / 86400 - ${FRESH_FULL_DAYS}))
                 / (${FRESH_ZERO_DAYS - FRESH_FULL_DAYS})
        ))
      END)
    )
  `;
}

// Self-check — run with `npx tsx lib/opportunity.ts` if you touch the formula.
// Kept dependency-free so it works even when the DB is offline.
if (require.main === module) {
  const now = new Date('2026-01-01T00:00:00Z');
  const cases: Array<[ScoreInput, string, (b: OpportunityBreakdown) => boolean]> = [
    [{ maxBounty: null, offersBounty: false, lastUpdatedAt: null }, 'empty', (b) => b.total === 0],
    [{ maxBounty: 250_000, offersBounty: true, lastUpdatedAt: now }, 'max everything', (b) => b.total >= 99],
    [{ maxBounty: 500, offersBounty: true, lastUpdatedAt: now }, 'floor payout + bounty + fresh', (b) => b.total === 20 + 25 && b.payout < 1],
    [{ maxBounty: 5_000, offersBounty: true, lastUpdatedAt: new Date('2025-10-01T00:00:00Z') }, '$5k, 92d stale', (b) => b.total > 40 && b.total < 65],
    [{ maxBounty: 50_000, offersBounty: false, lastUpdatedAt: null }, 'high payout but VDP + no updated', (b) => b.bounty === 0 && b.freshness === 0 && b.payout > 0],
  ];
  for (const [input, name, ok] of cases) {
    const b = opportunityScore(input, now);
    const pass = ok(b);
    // eslint-disable-next-line no-console
    console.log(`${pass ? 'ok ' : 'FAIL'} ${name}`, b);
    if (!pass) process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log('all opportunity score cases passed');
}
