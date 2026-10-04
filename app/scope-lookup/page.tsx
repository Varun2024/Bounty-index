import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckButton } from './check-button';
import { SearchIcon } from '@/app/_ui/icons';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ domain?: string }>;
}

export default async function ScopeLookup({ searchParams }: PageProps) {
  const { domain } = await searchParams;

  // ponytail: canonicalize to /scope/<domain> so results are shareable + indexable.
  // Keep ?domain= as a working alias for the legacy form target.
  if (domain) redirect(`/scope/${encodeURIComponent(domain)}`);

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      <div className="reveal">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Search</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Scope lookup</h1>
        <p className="text-neutral-400 mt-3 max-w-xl">
          Paste a domain, subdomain, or wildcard. Get every program it appears in — plus a warning if it&apos;s explicitly out-of-scope.
        </p>
      </div>

      <form action="/scope-lookup" method="get" className="mt-8 flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
          <input
            name="domain"
            autoFocus
            placeholder="e.g. shopify.com, *.tesla.com"
            className="focus-ring w-full mono text-sm pl-9 pr-3 py-2.5 bg-neutral-950/60 border border-neutral-800 rounded-md focus:outline-none focus:border-emerald-400/60 focus:bg-neutral-950 transition-colors"
          />
        </div>
        <CheckButton />
      </form>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {['shopify.com', 'tesla.com', 'api.twilio.com'].map((s) => (
          <Link
            key={s}
            href={`/scope/${encodeURIComponent(s)}`}
            className="mono text-xs px-4 py-3 border border-neutral-900 bg-neutral-950/40 rounded-lg hover:border-neutral-700 hover:bg-neutral-950 transition"
          >
            <span className="text-neutral-600">try · </span>
            <span className="text-neutral-300">{s}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
