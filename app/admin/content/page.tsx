import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { getSiteConfig } from '@/lib/site-config';
import { ConfigForm } from './config-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin · Content · Bounty Index',
  robots: { index: false, follow: false },
};

export default async function AdminContentPage() {
  const session = await auth();
  if (!isAdmin(session)) notFound();
  const config = await getSiteConfig();

  return (
    <div className="max-w-[900px] mx-auto px-6 py-10 space-y-8">
      <header className="border-b border-neutral-900 pb-6">
        <p className="mono text-[11px] uppercase tracking-widest text-neutral-400 mb-2">
          Internal · noindex · <Link href="/admin" className="hover:text-emerald-400 transition">← admin</Link>
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Site content</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Announcement strip, nudge timing + frequency caps, and banner copy. Saved live, no deploy.
          Changes appear on the next page load (config is cached ~5 min, but a save refreshes it immediately).
        </p>
      </header>
      <ConfigForm initial={config} />
    </div>
  );
}
