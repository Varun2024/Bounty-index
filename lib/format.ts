export function formatBounty(amount: number | null | undefined, currency = 'USD'): string {
  if (amount == null || amount <= 0) return '—';
  const sym = currency === 'EUR' ? '€' : '$';
  if (amount >= 1_000_000) return `${sym}${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  if (amount >= 10_000) return `${sym}${Math.round(amount / 1_000)}K`;
  if (amount >= 1_000) return `${sym}${(amount / 1_000).toFixed(1)}K`;
  return `${sym}${amount}`;
}

export const PLATFORM_META: Record<string, { label: string; dot: string }> = {
  hackerone: { label: 'HackerOne', dot: 'bg-red-400' },
  bugcrowd: { label: 'Bugcrowd', dot: 'bg-orange-400' },
  intigriti: { label: 'Intigriti', dot: 'bg-emerald-400' },
  yeswehack: { label: 'YesWeHack', dot: 'bg-sky-400' },
  federacy: { label: 'Federacy', dot: 'bg-violet-400' },
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
