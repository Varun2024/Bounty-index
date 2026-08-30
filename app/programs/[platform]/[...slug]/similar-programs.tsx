import Link from 'next/link';
import { formatPayoutRange, platformLabel, PLATFORM_META } from '@/lib/format';
import { SectionHeading } from '@/app/_ui/section-heading';
import type { SimilarProgram } from '@/lib/db/queries';

interface SimilarProgramsProps {
  items: SimilarProgram[];
}

export function SimilarPrograms({ items }: SimilarProgramsProps) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <SectionHeading title="Similar programs">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600">
          by shared scope
        </span>
      </SectionHeading>
      <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
        {items.map(({ program: p, overlap }, i) => {
          const dot = PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500';
          const payout = formatPayoutRange(p.minBounty, p.maxBounty, p.currency ?? 'USD');
          return (
            <li
              key={p.id}
              className={i === items.length - 1 ? '' : 'border-b border-neutral-900'}
            >
              <Link
                href={`/programs/${p.platform}/${p.slug}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-900/40 transition group"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
                <span className="mono text-xs text-neutral-500 shrink-0 hidden sm:inline">
                  {platformLabel(p.platform)}
                </span>
                <span className="text-neutral-200 group-hover:text-emerald-300 truncate flex-1">
                  {p.name}
                </span>
                {payout && (
                  <span className="mono text-[11px] text-emerald-300/80 shrink-0 hidden md:inline">
                    {payout.value}
                  </span>
                )}
                <span
                  className="mono text-[10px] uppercase tracking-widest text-neutral-600 shrink-0 tabular-nums"
                  title="shared in-scope identifiers"
                >
                  {overlap}× overlap
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
