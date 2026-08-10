export function formatBounty(amount: number | null | undefined, currency = 'USD'): string {
  if (amount == null || amount <= 0) return '—';
  const sym = currency === 'EUR' ? '€' : '$';
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 10_000) return `${sym}${Math.round(amount / 1_000)}K`;
  if (amount >= 1_000) return `${sym}${(amount / 1_000).toFixed(1)}K`;
  return `${sym}${amount}`;
}

// Render min–max as a range when both are known. Falls back to "up to X" or "from X" when
// only one side is present. Returns null when neither side is known so callers can skip the label.
export function formatPayoutRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency = 'USD',
): { label: string; value: string } | null {
  const hasMin = min != null && min > 0;
  const hasMax = max != null && max > 0;
  if (hasMin && hasMax) return { label: 'payout', value: `${formatBounty(min, currency)} – ${formatBounty(max, currency)}` };
  if (hasMax) return { label: 'payout up to', value: formatBounty(max, currency) };
  if (hasMin) return { label: 'payout from', value: formatBounty(min, currency) };
  return null;
}

export const PLATFORM_META: Record<string, { label: string; dot: string }> = {
  hackerone: { label: 'HackerOne', dot: 'bg-red-400' },
  bugcrowd: { label: 'Bugcrowd', dot: 'bg-orange-400' },
  intigriti: { label: 'Intigriti', dot: 'bg-emerald-400' },
  yeswehack: { label: 'YesWeHack', dot: 'bg-sky-400' },
  federacy: { label: 'Federacy', dot: 'bg-violet-400' },
  immunefi: { label: 'Immunefi', dot: 'bg-amber-400' },
};

export function platformLabel(id: string): string {
  return PLATFORM_META[id]?.label ?? id;
}

export function scopeHref(identifier: string): string | null {
  const id = identifier.trim();
  if (/^https?:\/\//i.test(id)) return id;
  if (/^\*\.[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(id)) return `https://${id.slice(2)}`;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/.*)?$/i.test(id)) return `https://${id}`;
  return null;
}

// Compact display form for a scope identifier. Strips the URL protocol, collapses long hex
// addresses to a first…last window, and caps overall length so a single row scans fast.
// The full identifier is preserved by callers via the `title` attribute and outbound `href`.
export function shortenIdentifier(id: string, maxLen = 64): string {
  let s = id.trim();
  s = s.replace(/^https?:\/\//i, '');
  // Ethereum-style addresses: 0x + 40 hex → 0xABCD…WXYZ
  s = s.replace(/0x[a-fA-F0-9]{20,}/g, (m) => `${m.slice(0, 6)}…${m.slice(-4)}`);
  // Solana/base58 addresses (32–44 chars, no 0x prefix): shorten if standalone
  s = s.replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, (m) => `${m.slice(0, 6)}…${m.slice(-4)}`);
  if (s.length <= maxLen) return s;
  // Fall back to middle-ellipsis, biased toward keeping the tail (which usually has the identifying bit).
  const head = Math.floor((maxLen - 1) * 0.55);
  const tail = maxLen - 1 - head;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function relativeTime(from: Date | null | undefined): string {
  if (!from) return '—';
  const diffMs = Date.now() - new Date(from).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
