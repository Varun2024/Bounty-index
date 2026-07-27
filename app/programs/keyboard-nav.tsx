'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export function KeyboardNav() {
  const router = useRouter();
  const indexRef = useRef(-1);

  useEffect(() => {
    const getRows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-row-href]'));

    const highlight = (i: number) => {
      const rows = getRows();
      if (!rows.length) return;
      const clamped = Math.max(0, Math.min(rows.length - 1, i));
      indexRef.current = clamped;
      rows.forEach((r, idx) => {
        r.dataset.active = idx === clamped ? '1' : '0';
        if (idx === clamped) r.scrollIntoView({ block: 'nearest' });
      });
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (e.key === '/' && !inField) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type=search]')?.focus();
        return;
      }
      if (inField) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        highlight(indexRef.current + 1);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        highlight(indexRef.current - 1);
      } else if (e.key === 'Enter') {
        const rows = getRows();
        const href = rows[indexRef.current]?.dataset.rowHref;
        if (href) router.push(href);
      } else if (e.key === 'Escape') {
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [router]);

  return null;
}
