import type { Metadata } from 'next';
import Link from 'next/link';
import { findByDomain } from '@/lib/db/queries';
import { CheckButton } from '@/app/scope-lookup/check-button';
import { SearchIcon } from '@/app/_ui/icons';
import { ScopeResults } from '@/app/scope-lookup/results';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ domain: string }>;
}

function cleanDomain(raw: string): string {
  // Decode once, trim, drop any protocol/path noise.
  const d = decodeURIComponent(raw).trim().toLowerCase();
  return d.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { domain: raw } = await params;
  const domain = cleanDomain(raw);
  const title = `${domain} in scope? — bounty.index`;
  const description = `Every bug bounty program that lists ${domain} as in-scope or out-of-scope. Searchable across HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy, and Immunefi.`;
  return {
    title,
    description,
    alternates: { canonical: `/scope/${encodeURIComponent(domain)}` },
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ScopeDomainPage({ params }: PageProps) {
  const { domain: raw } = await params;
  const domain = cleanDomain(raw);

  let dbError: string | null = null;
  let matches: Awaited<ReturnType<typeof findByDomain>> = [];
  try {
    matches = await findByDomain(domain);
  } catch (err) {
    dbError = err instanceof Error ? err.message : 'DB error';
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      <div className="reveal">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
          <Link href="/scope-lookup" className="hover:text-neutral-300 transition">scope</Link>
          <span className="text-neutral-700"> / </span>
          <span className="text-neutral-300">{domain}</span>
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">
          <code className="mono text-emerald-300">{domain}</code>
        </h1>
        <p className="text-neutral-400 mt-3 max-w-xl">
          Every program that lists this identifier — plus any that list it as explicitly out-of-scope.
        </p>
      </div>

      <form action="/scope-lookup" method="get" className="mt-8 flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
          <input
            name="domain"
            defaultValue={domain}
            placeholder="e.g. shopify.com, *.tesla.com"
            className="focus-ring w-full mono text-sm pl-9 pr-3 py-2.5 bg-neutral-950/60 border border-neutral-800 rounded-md focus:outline-none focus:border-emerald-400/60 focus:bg-neutral-950 transition-colors"
          />
        </div>
        <CheckButton />
      </form>

      {dbError ? (
        <p className="mono text-xs text-amber-400 mt-6">DB_NOT_CONNECTED — {dbError}</p>
      ) : (
        <ScopeResults domain={domain} matches={matches} />
      )}
    </div>
  );
}
