import Link from 'next/link';
import { findByDomain } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META } from '@/lib/format';
import { CheckButton } from './check-button';
import { SearchIcon } from '@/app/_ui/icons';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ domain?: string }>;
}

type Match = Awaited<ReturnType<typeof findByDomain>>[number];

export default async function ScopeLookup({ searchParams }: PageProps) {
  const { domain } = await searchParams;
  let matches: Match[] = [];
  let dbError: string | null = null;
  if (domain) {
    try {
      matches = await findByDomain(domain);
    } catch (err) {
      dbError = err instanceof Error ? err.message : 'DB error';
    }
  }

  const inScope = matches.filter((m) => m.scope.inScope);
  const outOfScope = matches.filter((m) => !m.scope.inScope);
  const inScopePrograms = new Set(inScope.map((m) => m.program.id)).size;
  const outOfScopePrograms = new Set(outOfScope.map((m) => m.program.id)).size;

  // Verdict severity: any in-scope wins. Only out-of-scope hits are a warning.
  const verdict: 'in' | 'out' | 'none' =
    inScope.length > 0 ? 'in' : outOfScope.length > 0 ? 'out' : 'none';

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-10">
      <div className="reveal">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Search</p>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">Scope lookup</h1>
        <p className="text-neutral-400 mt-3 max-w-xl">
          Paste a domain, subdomain, or wildcard. Get every program it appears in — plus a warning if it&apos;s explicitly out-of-scope.
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

      {domain && !dbError && (
        <>
          <Verdict
            domain={domain}
            verdict={verdict}
            inScopePrograms={inScopePrograms}
            outOfScopePrograms={outOfScopePrograms}
            inScopeEntries={inScope.length}
          />

          {verdict === 'none' && (
            <p className="mono text-xs text-neutral-500 mt-6">
              try a broader query — e.g. drop the subdomain, or use the parent domain
            </p>
          )}

          {inScope.length > 0 && (
            <MatchList
              title={`In scope · ${inScopePrograms} program${inScopePrograms === 1 ? '' : 's'}`}
              matches={inScope}
              kind="in"
            />
          )}

          {outOfScope.length > 0 && (
            <MatchList
              title={`Explicitly out of scope · ${outOfScopePrograms} program${outOfScopePrograms === 1 ? '' : 's'}`}
              matches={outOfScope}
              kind="out"
              note="These programs list this identifier as OUT-OF-SCOPE. Testing here could get you removed from the program."
            />
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

interface VerdictProps {
  domain: string;
  verdict: 'in' | 'out' | 'none';
  inScopePrograms: number;
  outOfScopePrograms: number;
  inScopeEntries: number;
}

function Verdict({ domain, verdict, inScopePrograms, outOfScopePrograms, inScopeEntries }: VerdictProps) {
  const style =
    verdict === 'in'
      ? {
          border: 'border-emerald-400/30',
          bg: 'bg-emerald-400/[0.04]',
          rail: 'via-emerald-400/50',
          chipText: 'text-emerald-300',
          chipBg: 'bg-emerald-400/10',
          chipBorder: 'border-emerald-400/30',
          label: 'in scope',
          domainColor: 'text-emerald-300',
        }
      : verdict === 'out'
        ? {
            border: 'border-amber-400/30',
            bg: 'bg-amber-400/[0.04]',
            rail: 'via-amber-400/50',
            chipText: 'text-amber-300',
            chipBg: 'bg-amber-400/10',
            chipBorder: 'border-amber-400/30',
            label: 'out of scope',
            domainColor: 'text-amber-300',
          }
        : {
            border: 'border-neutral-800',
            bg: 'bg-neutral-950/40',
            rail: 'via-neutral-700/40',
            chipText: 'text-neutral-500',
            chipBg: 'bg-neutral-900/60',
            chipBorder: 'border-neutral-800',
            label: 'no match',
            domainColor: 'text-neutral-300',
          };

  return (
    <div className={`mt-10 relative overflow-hidden rounded-xl border ${style.border} ${style.bg}`}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${style.rail} to-transparent`} />
      <div className="px-6 py-6 flex items-center gap-4 flex-wrap">
        <span className={`mono text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${style.chipText} ${style.chipBg} ${style.chipBorder}`}>
          {style.label}
        </span>
        <p className="text-lg text-neutral-100">
          {verdict === 'in' && (
            <>
              <code className={`mono ${style.domainColor}`}>{domain}</code>
              <span className="text-neutral-400"> appears in </span>
              <span className="mono text-neutral-100 tabular-nums">{inScopePrograms}</span>
              <span className="text-neutral-400"> program{inScopePrograms === 1 ? '' : 's'} · </span>
              <span className="mono text-neutral-500 tabular-nums">{inScopeEntries}</span>
              <span className="text-neutral-400"> scope entr{inScopeEntries === 1 ? 'y' : 'ies'}</span>
              {outOfScopePrograms > 0 && (
                <>
                  <span className="text-neutral-700"> · </span>
                  <span className="mono text-amber-300 tabular-nums">{outOfScopePrograms}</span>
                  <span className="text-neutral-400"> also list it as out-of-scope — see below</span>
                </>
              )}
            </>
          )}
          {verdict === 'out' && (
            <>
              <code className={`mono ${style.domainColor}`}>{domain}</code>
              <span className="text-neutral-400"> is </span>
              <span className="text-amber-300">explicitly listed as out-of-scope</span>
              <span className="text-neutral-400"> in </span>
              <span className="mono text-neutral-100 tabular-nums">{outOfScopePrograms}</span>
              <span className="text-neutral-400"> program{outOfScopePrograms === 1 ? '' : 's'}. Do not test.</span>
            </>
          )}
          {verdict === 'none' && (
            <>
              <code className={`mono ${style.domainColor}`}>{domain}</code>
              <span className="text-neutral-400"> — not listed by any indexed program</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

interface MatchListProps {
  title: string;
  matches: Match[];
  kind: 'in' | 'out';
  note?: string;
}

interface GroupedMatch {
  program: Match['program'];
  identifiers: string[]; // deduped, sorted (most specific first)
}

function groupByProgram(matches: Match[]): GroupedMatch[] {
  const groups = new Map<number, GroupedMatch>();
  for (const m of matches) {
    const existing = groups.get(m.program.id);
    if (existing) {
      if (!existing.identifiers.includes(m.scope.identifier)) {
        existing.identifiers.push(m.scope.identifier);
      }
    } else {
      groups.set(m.program.id, { program: m.program, identifiers: [m.scope.identifier] });
    }
  }
  // Longer identifiers = more specific; show those first.
  for (const g of groups.values()) g.identifiers.sort((a, b) => b.length - a.length);
  return [...groups.values()];
}

function MatchList({ title, matches, kind, note }: MatchListProps) {
  const groups = groupByProgram(matches);
  // When two programs on the same platform share a name (Bugcrowd has both a legacy `tesla` and a
  // managed `engagements/tesla`), show the slug to disambiguate — otherwise the rows look identical.
  const dupNames = new Set<string>();
  const seen = new Set<string>();
  for (const g of groups) {
    const key = `${g.program.platform}:${g.program.name}`;
    if (seen.has(key)) dupNames.add(key);
    seen.add(key);
  }
  const glyph = kind === 'in' ? '+' : '−';
  const glyphColor = kind === 'in' ? 'text-emerald-400' : 'text-amber-400';
  const identifierColor = kind === 'in' ? 'text-neutral-500' : 'text-amber-300/70';

  return (
    <div className="mt-8">
      <p className={`mono text-[10px] uppercase tracking-widest mb-3 ${kind === 'in' ? 'text-neutral-500' : 'text-amber-400'}`}>
        {title}
      </p>
      {note && (
        <p className="mono text-[11px] text-amber-300/80 bg-amber-400/[0.04] border border-amber-400/20 rounded-md px-3 py-2 mb-3">
          <span className="text-amber-400">⚠</span> {note}
        </p>
      )}
      <ul className={`border rounded-lg overflow-hidden ${kind === 'in' ? 'border-neutral-900 bg-neutral-950/40' : 'border-amber-400/15 bg-amber-400/[0.02]'}`}>
        {groups.map((g, i) => (
          <li key={g.program.id} className={i === groups.length - 1 ? '' : `border-b ${kind === 'in' ? 'border-neutral-900' : 'border-amber-400/10'}`}>
            <Link
              href={`/programs/${g.program.platform}/${g.program.slug}`}
              className={`flex items-start gap-4 px-5 py-3.5 transition group ${kind === 'in' ? 'hover:bg-neutral-900/50' : 'hover:bg-amber-400/[0.06]'}`}
            >
              <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${PLATFORM_META[g.program.platform]?.dot ?? 'bg-neutral-500'}`} />
              <div className="min-w-0 flex-1">
                <p className={`text-sm truncate transition ${kind === 'in' ? 'text-neutral-100 group-hover:text-emerald-400' : 'text-neutral-100 group-hover:text-amber-300'}`}>
                  {g.program.name}
                  {dupNames.has(`${g.program.platform}:${g.program.name}`) && (
                    <span className="mono text-[11px] text-neutral-600 ml-2 font-normal">/{g.program.slug}</span>
                  )}
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {g.identifiers.map((id) => (
                    <li key={id}>
                      <code className={`mono text-[11px] block truncate ${identifierColor}`}>
                        <span className={`${glyphColor} mr-1`}>{glyph}</span>
                        {id}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-right shrink-0">
                <p className="mono text-xs text-neutral-400">{platformLabel(g.program.platform)}</p>
                <p className="mono text-xs text-neutral-100 tabular-nums mt-0.5">
                  {formatBounty(g.program.maxBounty, g.program.currency ?? 'USD')}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
