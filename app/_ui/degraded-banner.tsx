import { isDbDegraded } from '@/lib/db/queries';
import type { DegradedBannerConfig } from '@/lib/site-config';

// Shown only while the DB is degraded (isDbDegraded gate stays). Copy is admin-editable.
export function DegradedBanner({ title, message }: DegradedBannerConfig) {
  if (!isDbDegraded()) return null;
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/[0.08] text-amber-200">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-2 text-xs md:text-sm flex items-center gap-2">
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>
          <strong className="font-medium">{title}</strong>{' '}
          {message}
        </span>
      </div>
    </div>
  );
}
