// Shared bounty-amount bands for every payout-distribution chart (program detail + home corpus).
// One source so the per-program histogram, the corpus histogram, and their axis labels never drift.
export interface PayoutBand {
  label: string;
  min: number;
  max: number; // exclusive; the last band is open-ended (Infinity)
}

export const PAYOUT_BANDS: readonly PayoutBand[] = [
  { label: '<$500', min: 0, max: 500 },
  { label: '$500–1k', min: 500, max: 1000 },
  { label: '$1–5k', min: 1000, max: 5000 },
  { label: '$5–10k', min: 5000, max: 10000 },
  { label: '$10–25k', min: 10000, max: 25000 },
  { label: '$25k+', min: 25000, max: Infinity },
];

export function bandIndex(usd: number): number {
  return PAYOUT_BANDS.findIndex((b) => usd >= b.min && usd < b.max);
}

// Count a list of USD amounts into the bands (one count per band, aligned to PAYOUT_BANDS).
export function bucketize(amounts: readonly number[]): number[] {
  const counts = PAYOUT_BANDS.map(() => 0);
  for (const a of amounts) {
    const i = bandIndex(a);
    if (i >= 0) counts[i]++;
  }
  return counts;
}

// ponytail self-check: run `npx tsx lib/payout-buckets.ts`
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const c = bucketize([100, 400, 750, 2500, 2500, 7000, 12000, 50000, 0]);
  console.assert(c[0] === 3, `<$500 should be 3 (0,100,400), got ${c[0]}`); // 0,100,400
  console.assert(c[1] === 1, `$500-1k should be 1 (750), got ${c[1]}`);
  console.assert(c[2] === 2, `$1-5k should be 2 (2500x2), got ${c[2]}`);
  console.assert(c[3] === 1, `$5-10k should be 1 (7000), got ${c[3]}`);
  console.assert(c[4] === 1, `$10-25k should be 1 (12000), got ${c[4]}`);
  console.assert(c[5] === 1, `$25k+ should be 1 (50000), got ${c[5]}`);
  console.assert(bandIndex(500) === 1, 'edge: 500 is $500-1k (min inclusive)');
  console.assert(bandIndex(499.99) === 0, 'edge: just under 500 is <$500');
  console.log('payout-buckets self-check passed');
}
