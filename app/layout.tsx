import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { Logo } from './_ui/logo';
import { GlobalKeyboard } from './_ui/global-keyboard';
import { CompareTray } from './_ui/compare-tray';
import { Analytics } from '@vercel/analytics/next';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Bounty Index — every bug bounty program, filterable',
  description: 'Aggregated index of bug bounty and VDP programs across every major platform.',
  openGraph: {
    title: 'bounty.index — bounties, live-indexed',
    description: 'Every public bug bounty program across HackerOne, Bugcrowd, Intigriti, YesWeHack, and Federacy. Filter by scope, asset type, and payout.',
    type: 'website',
    images: [{ url: '/og.png', width: 1792, height: 1024, alt: 'bounty.index' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'bounty.index — bounties, live-indexed',
    description: 'Every public bug bounty program, filterable.',
    images: ['/og.png'],
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-4">{title}</p>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
  external,
  dot,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  dot?: string;
}) {
  const props = external ? { target: '_blank', rel: 'noreferrer noopener' } : {};
  return (
    <li>
      <a
        href={href}
        {...props}
        className="text-sm text-neutral-400 hover:text-emerald-400 transition inline-flex items-center gap-2 focus-ring rounded"
      >
        {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
        {children}
      </a>
    </li>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="nav-underline px-2 md:px-3 py-1.5 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 transition focus-ring text-xs md:text-sm whitespace-nowrap"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-[#0a0a0b] text-neutral-200 font-sans">
        <header className="sticky top-0 z-20 backdrop-blur-md bg-[#0a0a0b]/80 border-b border-neutral-900" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
            <Link href="/" className="mono text-sm tracking-tight flex items-center gap-2.5 group focus-ring rounded-md py-1 -my-1">
              <Logo size={22} className="text-neutral-500 group-hover:text-neutral-300 transition" />
              <span className="text-neutral-100 group-hover:text-emerald-400 transition">bounty.index</span>
            </Link>
            <nav className="flex items-center gap-0.5 md:gap-1 text-sm">
              <NavLink href="/programs">Programs</NavLink>
              <NavLink href="/compare">Compare</NavLink>
              <NavLink href="/scope-lookup"><span className="hidden sm:inline">Scope lookup</span><span className="sm:hidden">Scope</span></NavLink>
              <NavLink href="/feed">New</NavLink>
              <span className="ml-4 mono text-[10px] uppercase tracking-widest text-neutral-600 hidden md:inline-flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-400">/</kbd>
                <span>to search</span>
              </span>
            </nav>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        </header>
        <main className="flex-1">{children}</main>
        <GlobalKeyboard />
        <CompareTray />
        <Analytics />
        <footer className="border-t border-neutral-900 relative overflow-hidden">
          <div
            className="absolute pointer-events-none inset-x-0 -top-20 h-40 opacity-25"
            style={{ background: 'radial-gradient(ellipse 50% 100% at 50% 0%, #34d399 0%, transparent 70%)' }}
          />
          <div className="relative max-w-[1400px] mx-auto px-6 pt-16 pb-10">
            <div className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10">
              <div>
                <Link href="/" className="mono text-sm tracking-tight flex items-center gap-2.5 group focus-ring rounded-md py-1 -my-1 w-fit">
                  <Logo size={22} className="text-neutral-500 group-hover:text-neutral-300 transition" />
                  <span className="text-neutral-100 group-hover:text-emerald-400 transition">bounty.index</span>
                </Link>
                <p className="mt-4 text-sm text-neutral-500 leading-relaxed max-w-xs">
                  The bug bounty market, live-indexed. Every public program across five platforms, filterable in one view.
                </p>
                <a
                  href="https://buymeacoffee.com/varun_builds"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-5 inline-flex items-center gap-2 mono text-xs px-3 py-2 border border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300 rounded-md hover:border-emerald-400/60 hover:bg-emerald-400/[0.12] transition focus-ring"
                >
                  <span aria-hidden>☕</span>
                  buy me a coffee
                </a>
              </div>

              <FooterCol title="Product">
                <FooterLink href="/programs">Programs</FooterLink>
                <FooterLink href="/compare">Compare</FooterLink>
                <FooterLink href="/scope-lookup">Scope lookup</FooterLink>
                <FooterLink href="/feed">New programs</FooterLink>
                <FooterLink href="/feed.xml" external>RSS feed</FooterLink>
              </FooterCol>

              <FooterCol title="Platforms">
                <FooterLink href="/programs?platform=hackerone" dot="bg-red-400">HackerOne</FooterLink>
                <FooterLink href="/programs?platform=bugcrowd" dot="bg-orange-400">Bugcrowd</FooterLink>
                <FooterLink href="/programs?platform=intigriti" dot="bg-emerald-400">Intigriti</FooterLink>
                <FooterLink href="/programs?platform=yeswehack" dot="bg-sky-400">YesWeHack</FooterLink>
                <FooterLink href="/programs?platform=federacy" dot="bg-violet-400">Federacy</FooterLink>
              </FooterCol>

              <FooterCol title="Resources">
                <FooterLink href="https://github.com/arkadiyt/bounty-targets-data" external>Data source</FooterLink>
                <FooterLink href="https://hackerone.com/hacktivity" external>Hacktivity</FooterLink>
                <FooterLink href="https://pentester.land/list-of-bug-bounty-writeups.html" external>Writeups</FooterLink>
                <FooterLink href="https://disclose.io" external>disclose.io</FooterLink>
              </FooterCol>
            </div>

            <div className="mt-16 pt-6 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-4 mono text-xs text-neutral-600">
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                <span>© 2026 bounty.index</span>
                <span className="text-neutral-800">·</span>
                <span>not affiliated with any platform</span>
              </div>
              <div className="flex items-center gap-3">
                <span>data · <a href="https://github.com/arkadiyt/bounty-targets-data" className="hover:text-emerald-400 transition">arkadiyt/bounty-targets-data</a></span>
                <span className="text-neutral-800">·</span>
                <span>MIT licensed</span>
                <span className="text-neutral-800">·</span>
                <span>updated daily</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
