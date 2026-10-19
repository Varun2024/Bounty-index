'use client';

import { useEffect, useState } from 'react';

const SECTIONS = [
  { id: 'scope', label: 'Scope' },
  { id: 'changes', label: 'Changes' },
  { id: 'community', label: 'Community' },
  { id: 'notes', label: 'Notes' },
] as const;

// Sticky sub-nav that highlights the section currently in view. Sticks just under the global
// header (h-14) so it's always reachable on this long page.
export function SectionNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Of the sections crossing the band near the top, pick the highest one.
        const inBand = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (inBand[0]) setActive(inBand[0].target.id);
      },
      // Active = section whose top sits in the upper slice of the viewport, just below the
      // sticky header + this bar.
      { rootMargin: '-104px 0px -70% 0px', threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="On this page"
      className="sticky top-14 z-10 -mx-6 mb-2 border-b border-neutral-900 bg-background/90 backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-6 py-3 text-sm">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600">On this page</span>
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={isActive ? 'true' : undefined}
              className={`focus-ring rounded underline underline-offset-4 transition ${
                isActive
                  ? 'text-emerald-300 decoration-emerald-400'
                  : 'text-neutral-400 decoration-neutral-800 hover:text-emerald-300 hover:decoration-emerald-400'
              }`}
            >
              {s.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
