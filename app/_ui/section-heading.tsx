import type { ReactNode } from 'react';

interface SectionHeadingProps {
  title: string;
  // Optional right-side content (count pill, RSS link, status pill, action, etc.).
  children?: ReactNode;
  // Semantic tag — defaults to h2 for detail-page sections. Use "p" for smaller subsections.
  as?: 'h2' | 'h3' | 'p';
  // Caller can override spacing when a section needs tighter/looser rhythm.
  className?: string;
}

// The `mono text-[10px] uppercase tracking-widest text-neutral-500` heading treatment used
// across program detail sections, filter groups, and page eyebrows. Extracted after the
// pattern appeared in 6+ places.
export function SectionHeading({ title, children, as: Comp = 'h2', className = 'mb-3' }: SectionHeadingProps) {
  return (
    <div className={`flex items-baseline justify-between ${className}`}>
      <Comp className="mono text-[10px] uppercase tracking-widest text-neutral-500">{title}</Comp>
      {children}
    </div>
  );
}
