import type { ReactNode } from 'react';

interface SectionHeadingProps {
  title: string;
  // Optional right-side content (count pill, RSS link, status pill, action, etc.).
  children?: ReactNode;
  // Semantic tag — defaults to h2 for detail-page sections. Use "p" for smaller subsections.
  as?: 'h2' | 'h3' | 'p';
  // Caller can override spacing when a section needs tighter/looser rhythm.
  className?: string;
  // "subtle" (default): mono 10px eyebrow — reads as metadata.
  // "prominent": larger sans-serif heading with an emerald rail — reads as a section anchor.
  // Use prominent for 1–2 top-priority sections per page so hierarchy is actually visible.
  variant?: 'subtle' | 'prominent';
}

// Visual-hierarchy heading. Default stays the mono eyebrow treatment used everywhere.
// Prominent variant is intentionally rare: pick ≤ 2 per page for the content that matters most.
export function SectionHeading({
  title,
  children,
  as: Comp = 'h2',
  className,
  variant = 'subtle',
}: SectionHeadingProps) {
  if (variant === 'prominent') {
    return (
      <div className={`flex items-baseline justify-between gap-4 ${className ?? 'mb-4'}`}>
        <Comp className="text-xl md:text-2xl font-semibold tracking-tight text-neutral-100 inline-flex items-center gap-3">
          <span aria-hidden className="w-1 h-5 bg-emerald-400 rounded-sm" />
          {title}
        </Comp>
        {children}
      </div>
    );
  }
  return (
    <div className={`flex items-baseline justify-between ${className ?? 'mb-3'}`}>
      <Comp className="mono text-[10px] uppercase tracking-widest text-neutral-500">{title}</Comp>
      {children}
    </div>
  );
}
