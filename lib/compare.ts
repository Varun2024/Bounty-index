'use client';

import { useEffect, useState, useCallback } from 'react';

const KEY = 'bounty-index:compare';
const MAX = 4;

function read(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)).slice(0, MAX);
  } catch {
    return [];
  }
}

function write(ids: number[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  window.dispatchEvent(new Event('compare:change'));
}

export function useCompareSelection() {
  const [ids, setIds] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIds(read());
    setHydrated(true);
    const onChange = () => setIds(read());
    window.addEventListener('compare:change', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('compare:change', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const toggle = useCallback((id: number) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, MAX);
    write(next);
    setIds(next);
  }, []);

  const remove = useCallback((id: number) => {
    const next = read().filter((x) => x !== id);
    write(next);
    setIds(next);
  }, []);

  const clear = useCallback(() => {
    write([]);
    setIds([]);
  }, []);

  return { ids, hydrated, toggle, remove, clear, max: MAX, isFull: ids.length >= MAX };
}
