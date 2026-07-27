import Link from 'next/link';
import { findByDomain } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META } from '@/lib/format';
import { CheckButton } from './check-button';
import { SearchIcon } from '@/app/_ui/icons';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ domain?: string }>;
}

export default async function ScopeLookup({ searchParams }: PageProps) {
  const { domain } = await searchParams;
  let matches: Awaited<ReturnType<typeof findByDomain>> = [];
  let dbError: string | null = null;
  if (domain) {
    try {
      matches = await findByDomain(domain);
    } catch (err) {
      dbError = err instanceof Error ? err.message : 'DB error';
    }
  }

  // Group by program for the verdict
  const uniquePrograms = new Map<number, (typeof matches)[number]['program']>();
  for (const m of matches) {
    if (!uniquePrograms.has(m.program.id)) uniquePrograms.set(m.program.id, m.program);
  }
  const programCount = uniquePrograms.size;

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      <div className="reveal">
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Search</p>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Scope lookup</h1>
      <p className="text-neutral-400 mt-3 max-w-xl">
        Paste a domain, subdomain, or wildcard. Get every program it appears in — in-scope only.
      </p>
      </div>

      <form className="mt-8 flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" />
          <input
            name="domain"
            defaultValue={domain}
            autoFocus
            placeholder="e.g. shopify.com, *.tesla.com"
            className="focus-ring w-full mono text-sm pl-9 pr-3 py-2.5 bg-neutral-950/60 border border-neutral-800 rounded-md focus:outline-none focus:border-emerald-400/60 focus:bg-neutral-950 transition-colors"
          />
        </div>
        <CheckButton />
      </form>

      {dbError && (
        <p className="mono text-xs text-amber-400 mt-6">DB_NOT_CONNECTED — {dbError}</p>
      )}

      {/* Verdict */}
      {domain && !dbError && (
        <>
          <div
            className={`mt-10 relative overflow-hidden rounded-xl border ${
              programCount > 0
                ? 'border-emerald-400/30 bg-emerald-400/[0.04]'
                : 'border-neutral-800 bg-neutral-950/40'
            }`}
          >
            <div
              className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${programCount > 0 ? 'via-emerald-400/50' : 'via-neutral-700/40'} to-transparent`}
            />
            <div className="px-6 py-6 flex items-center gap-4">
              <span
                className={`mono text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                  programCount > 0
                    ? 'text-emerald-300 bg-emerald-400/10 border border-emerald-400/30'
                    : 'text-neutral-500 bg-neutral-900/60 border border-neutral-800'
                }`}
              >
                {programCount > 0 ? 'in scope' : 'no match'}
              </span>
              <p className="text-lg text-neutral-100">
                {programCount > 0 ? (
                  <>
                    <code className="mono text-emerald-300">{domain}</code>
                    <span className="text-neutral-400"> appears in </span>
                    <span className="mono text-neutral-100 tabular-nums">{programCount}</span>
                    <span className="text-neutral-400"> program{programCount === 1 ? '' : 's'} · </span>
                    <span className="mono text-neutral-500 tabular-nums">{matches.length}</span>
                    <span className="text-neutral-400"> scope entr{matches.length === 1 ? 'y' : 'ies'}</span>
                  </>
                ) : (
                  <>
                    <code className="mono text-neutral-300">{domain}</code>
                    <span className="text-neutral-400"> — no in-scope program found</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {programCount === 0 && (
            <p className="mono text-xs text-neutral-500 mt-6">
              try a broader query — e.g. drop the subdomain, or use the parent domain
            </p>
          )}

          {matches.length > 0 && (
            <div className="mt-8">
              <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Matches · {matches.length}</p>
              <ul className="border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40">
                {matches.map((m, i) => (
                  <li key={i} className={i === matches.length - 1 ? '' : 'border-b border-neutral-900'}>
                    <Link
                      href={`/programs/${m.program.platform}/${m.program.slug}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-900/50 transition group"
                    >
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${PLATFORM_META[m.program.platform]?.dot ?? 'bg-neutral-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-neutral-100 group-hover:text-emerald-400 transition truncate">{m.program.name}</p>
                        <code className="mono text-[11px] text-neutral-500 block truncate mt-0.5">+ {m.scope.identifier}</code>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="mono text-xs text-neutral-400">{platformLabel(m.program.platform)}</p>
                        <p className="mono text-xs text-neutral-100 tabular-nums mt-0.5">
                          {formatBounty(m.program.maxBounty, m.program.currency ?? 'USD')}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {!domain && !dbError && (
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {['shopify.com', 'tesla.com', 'api.twilio.com'].map((s) => (
            <Link
              key={s}
              href={`/scope-lookup?domain=${encodeURIComponent(s)}`}
              className="mono text-xs px-4 py-3 border border-neutral-900 bg-neutral-950/40 rounded-lg hover:border-neutral-700 hover:bg-neutral-950 transition"
            >
              <span className="text-neutral-600">try · </span>
              <span className="text-neutral-300">{s}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
