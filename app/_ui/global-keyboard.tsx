'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Global `/` shortcut. On /programs the KeyboardNav still handles j/k/Enter.
// Elsewhere `/` sends the user to /programs with the search field focused.
export function GlobalKeyboard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      if (inField) return;
      e.preventDefault();
      const input = document.querySelector<HTMLInputElement>('input[type=search]');
      if (input) {
        input.focus();
        return;
      }
      if (pathname !== '/programs') router.push('/programs');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pathname, router]);

  return null;
}
