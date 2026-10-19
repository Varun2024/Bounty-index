import Link from 'next/link';
import type { ReactNode } from 'react';

interface EmptyStateAction {
  href: string;
  label: string;
}

interface EmptyStateProps {
  // Short mono eyebrow line. No em dashes (R-02); the codebase's terminal voice reads fine plain.
  title: string;
  children: ReactNode;
  action?: EmptyStateAction;
  // Cross-link line: the point of these empty states is to teach an adjacent feature, not dead-end.
  footnote?: ReactNode;
}

export function EmptyState({ title, children, action, footnote }: EmptyStateProps) {
  return (
    <div className="border border-neutral-900 rounded-lg p-12 bg-neutral-950/40 text-center">
      <p className="mono text-xs uppercase tracking-widest text-neutral-500">{title}</p>
      <div className="mt-3 text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">{children}</div>
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-flex items-center gap-2 mono text-sm px-4 py-2 border border-neutral-800 rounded-md text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900 transition focus-ring"
        >
          {action.label}
        </Link>
      )}
      {footnote && <p className="mt-4 mono text-[11px] text-neutral-500">{footnote}</p>}
    </div>
  );
}
