'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFocusTrap } from './use-focus-trap';

interface Command {
  label: string;
  href: string;
  hint?: string;
  keywords?: string;
  beta?: boolean;
}

// Mirrors the nav surface so the palette can reach every page/action. Kept flat (not grouped)
// because the palette ranks by the query, not by section.
const COMMANDS: Command[] = [
  { label: 'Programs', href: '/programs', hint: 'the full index', keywords: 'index list table browse' },
  { label: 'Scope lookup', href: '/scope-lookup', hint: 'paste a domain', keywords: 'domain asset in scope target' },
  { label: "What's new", href: '/whats-new', hint: 'scope + reward changes', keywords: 'changelog changes diff' },
  { label: 'Reward changes', href: '/reward-changes', hint: 'payouts over time', keywords: 'money bounty up down' },
  { label: 'New programs', href: '/feed', hint: 'recently added', keywords: 'feed rss latest' },
  { label: 'Watchlist', href: '/watchlist', hint: 'your pinned programs', keywords: 'saved track pin' },
  { label: 'Compare', href: '/compare', hint: 'side by side', keywords: 'versus diff' },
  { label: 'Discord alerts', href: '/settings/discord', hint: 'per-program webhook', keywords: 'notify webhook' },
  { label: 'Opportunity score', href: '/how-scored', hint: 'the 0-100 formula', keywords: 'ranking rank formula' },
  { label: 'How it works', href: '/how-it-works', hint: 'data + cadence', keywords: 'about source faq' },
  { label: 'MCP server', href: '/mcp', hint: 'query from AI tools', keywords: 'claude cursor agent api', beta: true },
  { label: 'Keyboard shortcuts', href: '#shortcuts', hint: 'press ?', keywords: 'keys hotkeys help' },
];

interface ProgramRow {
  id: number;
  name: string;
  platform: string;
  slug: string;
}

type Item =
  | { kind: 'command'; key: string; label: string; hint?: string; beta?: boolean; href: string }
  | { kind: 'program'; key: string; label: string; hint: string; href: string }
  | { kind: 'search'; key: string; label: string; href: string };

export function CommandPalette() {
  const router = useRouter();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Trap Tab inside the dialog and restore focus on close. Declared before the autofocus
  // effect so the opener is captured before focus moves into the input.
  useFocusTrap(dialogRef, open);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setPrograms([]);
    setActive(0);
  }, []);

  // Global ⌘K / Ctrl+K opens the palette from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Focus the input when it opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced live program search against the existing JSON endpoint. All setState happens
  // inside the timeout callback (async), never synchronously in the effect body.
  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      if (q.length < 2) {
        setPrograms([]);
        return;
      }
      fetch(`/api/search-programs?q=${encodeURIComponent(q)}&limit=6`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { rows: [] }))
        .then((d: { rows?: ProgramRow[] }) => setPrograms(d.rows ?? []))
        .catch(() => {
          // Aborted or failed: leave whatever is there, the page/action rows still work.
        });
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const commandItems: Item[] = COMMANDS.filter((c) =>
      q === '' ? true : (c.label + ' ' + (c.keywords ?? '') + ' ' + (c.hint ?? '')).toLowerCase().includes(q),
    ).map((c) => ({ kind: 'command', key: 'c:' + c.href, label: c.label, hint: c.hint, beta: c.beta, href: c.href }));

    const programItems: Item[] = programs.map((p) => ({
      kind: 'program',
      key: 'p:' + p.id,
      label: p.name,
      hint: p.platform,
      href: `/programs/${p.platform}/${p.slug}`,
    }));

    const searchItem: Item[] =
      query.trim().length > 0
        ? [{ kind: 'search', key: 'search', label: `Search all programs for “${query.trim()}”`, href: `/programs?q=${encodeURIComponent(query.trim())}` }]
        : [];

    return [...commandItems, ...programItems, ...searchItem];
  }, [query, programs]);

  // Derived, so a shrinking list can't leave `active` pointing past the end (no effect needed).
  const activeIndex = items.length ? Math.min(active, items.length - 1) : 0;

  const select = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      close();
      // Sentinel: open the shortcuts overlay instead of navigating.
      if (item.href === '#shortcuts') {
        window.dispatchEvent(new CustomEvent('shortcuts:open'));
        return;
      }
      window.dispatchEvent(new CustomEvent('navprogress:start'));
      router.push(item.href);
    },
    [close, router],
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (items.length ? (a + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(items[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  return (
    <>
      {/* Visible trigger doubles as the discovery hint for the shortcut. Desktop only: the
          palette is keyboard-first and mobile uses the hamburger nav. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 h-10 w-10 md:h-8 md:w-auto md:pl-2.5 md:pr-1.5 rounded-md border border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition focus-ring"
        aria-label="Open command menu"
      >
        <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" className="md:w-[14px] md:h-[14px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="hidden md:flex mono text-[10px] uppercase tracking-widest items-center gap-1">
          <kbd className="px-1 py-0.5 border border-neutral-800 rounded bg-neutral-900/80 normal-case tracking-normal">⌘K</kbd>
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
          role="presentation"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div aria-hidden className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm" />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            className="relative w-full max-w-[560px] rounded-xl border border-neutral-800 bg-background shadow-[0_24px_80px_-16px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-neutral-900">
              <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" className="shrink-0 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-activedescendant={items[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
                aria-label="Search pages, actions, and programs"
                placeholder="Jump to a page, action, or program"
                className="flex-1 min-w-0 bg-transparent text-base text-neutral-50 placeholder:text-neutral-500 outline-none"
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="mono text-[10px] text-neutral-500 px-1.5 py-0.5 border border-neutral-800 rounded">esc</kbd>
            </div>

            <ul id={listboxId} role="listbox" aria-label="Results" className="max-h-[52vh] overflow-y-auto py-1.5">
              {items.length === 0 ? (
                <li className="px-4 py-6 text-sm text-neutral-500 text-center">No matches.</li>
              ) : (
                items.map((item, i) => (
                  <li key={item.key} role="presentation">
                    <button
                      type="button"
                      id={`${listboxId}-${i}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseMove={() => setActive(i)}
                      onClick={() => select(item)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition ${
                        i === active ? 'bg-neutral-900' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        {item.kind === 'program' ? (
                          <span aria-hidden className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
                        ) : item.kind === 'search' ? (
                          <span aria-hidden className="shrink-0 text-neutral-500 text-xs">↵</span>
                        ) : (
                          <span aria-hidden className="shrink-0 text-neutral-600 text-xs">→</span>
                        )}
                        <span className="truncate text-sm text-neutral-100">{item.label}</span>
                        {item.kind === 'command' && item.beta && (
                          <span className="mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-300">beta</span>
                        )}
                      </span>
                      {'hint' in item && item.hint && (
                        <span className="shrink-0 mono text-[11px] text-neutral-500 truncate max-w-[45%]">{item.hint}</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
