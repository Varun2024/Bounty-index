'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  desc: string;
  beta?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Grouped so the ~10 features that used to live only in the footer get a persistent
// surface. The per-item desc is the point: a visitor learns what each feature does,
// not just that it exists. Routes are all real pages (R-24).
const GROUPS: NavGroup[] = [
  {
    id: 'explore',
    label: 'Explore',
    items: [
      { href: '/scope-lookup', label: 'Scope lookup', desc: 'Paste a domain, see which programs cover it' },
      { href: '/whats-new', label: "What's new", desc: 'Scope and reward changes across every program' },
      { href: '/reward-changes', label: 'Reward changes', desc: 'Payouts going up and down over time' },
      { href: '/feed', label: 'New programs', desc: 'Programs added in the last two weeks' },
    ],
  },
  {
    id: 'track',
    label: 'Track',
    items: [
      { href: '/watchlist', label: 'Watchlist', desc: 'Pin programs and watch their scope move' },
      { href: '/compare', label: 'Compare', desc: 'Put up to three programs side by side' },
      { href: '/settings/discord', label: 'Discord alerts', desc: 'One webhook per program, no email needed' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      { href: '/how-scored', label: 'Opportunity score', desc: 'How the 0 to 100 ranking is built' },
      { href: '/how-it-works', label: 'How it works', desc: 'Where the data comes from, and how often' },
      { href: '/mcp', label: 'MCP server', desc: 'Query the index from Claude or Cursor', beta: true },
    ],
  },
];

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      width="10"
      height="10"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BetaTag() {
  return (
    <span className="mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-300">
      beta
    </span>
  );
}

function ItemLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="group/item block rounded-md px-3 py-2.5 hover:bg-neutral-900 transition focus-ring"
    >
      <span className="flex items-center gap-2 text-sm text-neutral-200 group-hover/item:text-emerald-300 transition">
        {item.label}
        {item.beta && <BetaTag />}
      </span>
      <span className="block text-xs text-neutral-400 mt-0.5 leading-snug">{item.desc}</span>
    </Link>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Menus close via each item's onClick and via outside-click below; no route-change
  // effect needed (and setState-in-effect is a lint error).

  // Outside-click + Escape close.
  useEffect(() => {
    if (!openGroup && !mobileOpen) return;
    function onPointer(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openGroup, mobileOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const groupActive = (g: NavGroup) => g.items.some((i) => isActive(i.href));
  const programsActive = pathname === '/programs' || pathname.startsWith('/programs/');

  return (
    <div ref={containerRef} className="flex items-center">
      {/* Desktop: primary link + grouped dropdowns */}
      <nav className="hidden md:flex items-center gap-0.5">
        <Link
          href="/programs"
          className={`nav-underline px-3 py-1.5 rounded-md transition focus-ring text-sm whitespace-nowrap ${
            programsActive ? 'text-neutral-100' : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900'
          }`}
        >
          Programs
        </Link>

        {GROUPS.map((g) => {
          const open = openGroup === g.id;
          return (
            <div key={g.id} className="relative">
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpenGroup(open ? null : g.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition focus-ring text-sm whitespace-nowrap ${
                  open || groupActive(g)
                    ? 'text-neutral-100 bg-neutral-900'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900'
                }`}
              >
                {g.label}
                <Caret open={open} />
              </button>
              {open && (
                <div className="absolute top-full left-0 mt-1.5 w-72 rounded-lg border border-neutral-800 bg-background p-1.5 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.7)] z-30">
                  {g.items.map((item) => (
                    <ItemLink key={item.href} item={item} onNavigate={() => setOpenGroup(null)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Mobile: hamburger toggles a full-width panel */}
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        onClick={() => setMobileOpen((v) => !v)}
        className="md:hidden inline-flex items-center justify-center w-10 h-10 -mr-1 rounded-md text-neutral-300 hover:text-neutral-100 hover:bg-neutral-900 transition focus-ring"
      >
        <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
        </svg>
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed left-0 right-0 top-14 z-30 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-neutral-900 bg-background/98 backdrop-blur-md px-4 py-4">
          <Link
            href="/programs"
            onClick={() => setMobileOpen(false)}
            className="block rounded-md px-3 py-2.5 text-sm text-neutral-100 hover:bg-neutral-900 transition focus-ring"
          >
            Programs
          </Link>
          {GROUPS.map((g) => (
            <div key={g.id} className="mt-4 first:mt-2">
              <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 px-3 mb-1">{g.label}</p>
              {g.items.map((item) => (
                <ItemLink key={item.href} item={item} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
