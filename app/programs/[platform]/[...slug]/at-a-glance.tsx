import { relativeTime } from '@/lib/format';

interface Tile {
  label: string;
  value: string;
  sub?: string;
}

interface AtAGlanceProps {
  inScopeCount: number;
  outOfScopeCount: number;
  assetTypeMix: { type: string; count: number }[];
  medianFirstResponseDays: number | null;
  reportCount: number;
  lastChangeAt: Date | null;
}

export function AtAGlance({
  inScopeCount,
  outOfScopeCount,
  assetTypeMix,
  medianFirstResponseDays,
  reportCount,
  lastChangeAt,
}: AtAGlanceProps) {
  const tiles: Tile[] = [
    {
      label: 'first response',
      value: medianFirstResponseDays === null ? '—' : formatDays(medianFirstResponseDays),
      sub: reportCount === 0 ? 'no reports yet' : `median · ${reportCount} report${reportCount === 1 ? '' : 's'}`,
    },
    {
      label: 'scope',
      value: String(inScopeCount),
      sub: `${outOfScopeCount} out`,
    },
    {
      label: 'asset mix',
      value: assetTypeMix[0]?.type ?? '—',
      sub: assetTypeMix
        .slice(0, 3)
        .map((b) => `${b.count} ${b.type}`)
        .join(' · ') || 'no in-scope',
    },
    {
      label: 'last change',
      value: lastChangeAt ? relativeTime(lastChangeAt) : '—',
      sub: lastChangeAt ? 'from snapshot diff' : 'no history yet',
    },
  ];

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="border border-neutral-900 rounded-lg bg-neutral-950/40 px-4 py-3"
        >
          <div className="mono text-[10px] uppercase tracking-widest text-neutral-500">{t.label}</div>
          <div className="mt-1 text-neutral-100 text-lg tabular-nums truncate" title={t.value}>{t.value}</div>
          {t.sub && (
            <div className="mono text-[10px] uppercase tracking-widest text-neutral-600 truncate" title={t.sub}>
              {t.sub}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function formatDays(d: number): string {
  if (d < 1) return '<1d';
  if (d < 10) return `${d.toFixed(1)}d`;
  return `${Math.round(d)}d`;
}
