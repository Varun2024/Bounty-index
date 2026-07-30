'use client';

import { useEffect, useState } from 'react';
import { FilterIcon } from '@/app/_ui/icons';

interface FilterDrawerProps {
  children: React.ReactNode;
  activeCount: number;
}

// Mobile-only wrapper: renders a fixed "Filters (N)" button that opens a bottom sheet.
// On md+ the children render inline unchanged.
export function FilterDrawer({ children, activeCount }: FilterDrawerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      {/* Desktop: render children inline */}
      <div className="hidden md:block">{children}</div>

      {/* Mobile: floating button + bottom sheet */}
      <div className="md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="focus-ring w-full mono text-xs uppercase tracking-widest flex items-center justify-between gap-3 px-4 py-3 bg-neutral-950/60 border border-neutral-800 rounded-lg hover:border-neutral-700 transition"
        >
          <span className="inline-flex items-center gap-2 text-neutral-300">
            <FilterIcon size={14} />
            Filters
          </span>
          <span className={activeCount > 0 ? 'text-emerald-400' : 'text-neutral-600'}>
            {activeCount > 0 ? `${activeCount} active` : 'tap to filter'}
          </span>
        </button>

        {open && (
          <div className="fixed inset-0 z-40 flex flex-col justify-end">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close filters"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fade-in_.2s_ease-out_both]"
            />
            <div className="relative bg-[#0a0a0b] border-t border-neutral-800 rounded-t-2xl max-h-[85vh] flex flex-col animate-[slide-up_.28s_cubic-bezier(0.16,1,0.3,1)_both]">
              <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-neutral-900">
                <div className="mx-auto absolute left-1/2 -translate-x-1/2 -top-1 w-10 h-1 rounded-full bg-neutral-800" />
                <span className="mono text-[10px] uppercase tracking-widest text-neutral-500 inline-flex items-center gap-2">
                  <FilterIcon size={12} />
                  Filters
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="mono text-xs text-neutral-500 hover:text-neutral-200 transition px-2 py-1"
                >
                  done
                </button>
              </div>
              <div className="overflow-y-auto p-5">{children}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
