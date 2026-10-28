'use client';

import { useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatBounty, platformLabel, PLATFORM_META } from '@/lib/format';
import { checkScope, type HeroScopeResult, type HeroScopeMatch } from '@/app/actions/scope';

// The hero's primary input: a live "is it in scope?" check, the product's signature
// move made touchable on the homepage. Paste a domain, get a verdict inline without
// leaving the page. Replaces the old keyword search box (which just navigated to
// /programs) so there's one input, not two search-like boxes. Full breakdown and the
// keyword browse both stay one click away. type="search" so the global `/` shortcut
// (GlobalKeyboard focuses input[type=search]) still lands here.

const EXAMPLES = ['tesla.com', '*.stripe.com', 'api.github.com'];

const VERDICT_STYLE = {
  in: { pill: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30', rail: 'via-emerald-400/50', border: 'border-emerald-400/30', bg: 'bg-emerald-400/[0.04]', label: 'in scope' },
  out: { pill: 'text-amber-300 bg-amber-400/10 border-amber-400/30', rail: 'via-amber-400/50', border: 'border-amber-400/30', bg: 'bg-amber-400/[0.04]', label: 'out of scope' },
  none: { pill: 'text-neutral-400 bg-neutral-900/60 border-neutral-800', rail: 'via-neutral-700/40', border: 'border-neutral-800', bg: 'bg-neutral-950/40', label: 'no match' },
} as const;

export function HeroScopeCheck({ programCount }: { programCount: string | null }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<HeroScopeResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [lastChecked, setLastChecked] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  function run(value: string) {
    const v = value.trim();
    if (!v) {
      setResult({ ok: false, error: 'empty' });
      return;
    }
    setLastChecked(v);
    startTransition(async () => {
      setResult(await checkScope(v));
    });
  }

  function onExample(ex: string) {
    setQuery(ex);
    run(ex);
    inputRef.current?.focus();
  }

  return (
    <div className="mt-12 max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
        role="search"
        aria-label="Check whether a domain is in scope"
      >
        <label htmlFor={inputId} className="sr-only">Domain, subdomain, or wildcard</label>
        <div className="group flex items-center h-14 pl-5 pr-1.5 rounded-xl bg-neutral-950/70 border border-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] focus-within:border-emerald-400/60 focus-within:shadow-[0_0_0_4px_rgba(52,211,153,0.08),inset_0_1px_0_rgba(255,255,255,0.02)] transition duration-200">
          <span className="shrink-0 mono text-base text-emerald-400/70 group-focus-within:text-emerald-300 transition select-none" aria-hidden>$</span>
          <input
            id={inputId}
            ref={inputRef}
            type="search"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="is a domain in scope? e.g. shopify.com"
            className="flex-1 min-w-0 bg-transparent h-full px-3.5 text-base md:text-[17px] text-neutral-50 placeholder:text-neutral-500 outline-none"
          />
          <kbd className="hidden md:inline-flex items-center justify-center mono text-[10px] text-neutral-400 h-6 px-1.5 mr-2 rounded border border-neutral-800 bg-neutral-900/80 pointer-events-none">
            /
          </kbd>
          <button
            type="submit"
            disabled={pending}
            className="mono text-sm h-11 px-4 sm:px-5 rounded-lg bg-emerald-400 text-neutral-950 font-medium hover:bg-emerald-300 active:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition focus-ring shrink-0"
          >
            {pending ? '…' : <><span className="sm:hidden">check</span><span className="hidden sm:inline">check scope</span></>}
          </button>
        </div>
      </form>

      {/* Results / states. aria-live so screen readers announce the verdict. */}
      <div role="status" aria-live="polite" className="mt-4">
        {pending ? (
          <LoadingLine domain={lastChecked} />
        ) : result && !result.ok ? (
          <ErrorLine error={result.error} />
        ) : result && result.ok ? (
          <Result result={result} />
        ) : (
          <Idle onExample={onExample} programCount={programCount} />
        )}
      </div>
    </div>
  );
}

function Idle({ onExample, programCount }: { onExample: (ex: string) => void; programCount: string | null }) {
  return (
    <p className="text-sm text-neutral-400 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <span className="text-neutral-500">try</span>
      {EXAMPLES.map((ex) => (
        <button
          key={ex}
          type="button"
          onClick={() => onExample(ex)}
          className="mono text-xs px-2.5 py-1 rounded-md border border-neutral-800 text-neutral-300 hover:border-emerald-400/50 hover:text-emerald-300 hover:bg-emerald-400/[0.04] transition focus-ring"
        >
          {ex}
        </button>
      ))}
      <span aria-hidden className="text-neutral-700">·</span>
      <Link href="/programs" className="text-neutral-300 hover:text-emerald-300 transition underline decoration-neutral-700 underline-offset-4 hover:decoration-emerald-400">
        or browse all {programCount && <span className="mono tabular-nums">{programCount}</span>}
      </Link>
    </p>
  );
}

function LoadingLine({ domain }: { domain: string }) {
  return (
    <p className="mono text-sm text-neutral-500 flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 motion-safe:animate-pulse" aria-hidden />
      checking <span className="text-neutral-300">{domain}</span> against the index…
    </p>
  );
}

function ErrorLine({ error }: { error: 'empty' | 'too_long' | 'db' }) {
  const msg =
    error === 'empty'
      ? 'Enter a domain to check, e.g. shopify.com'
      : error === 'too_long'
        ? 'That does not look like a domain. Try a hostname like shopify.com'
        : 'The index is unreachable right now. Try the full lookup.';
  return (
    <p className="mono text-sm text-amber-300/90">
      {msg}
      {error === 'db' && (
        <>
          {' '}
          <Link href="/scope-lookup" className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2 transition">
            /scope-lookup
          </Link>
        </>
      )}
    </p>
  );
}

function Result({ result }: { result: Extract<HeroScopeResult, { ok: true }> }) {
  const { domain, verdict, inScopePrograms, outOfScopePrograms, matches } = result;
  const s = VERDICT_STYLE[verdict];

  return (
    <div className={`relative overflow-hidden rounded-xl border ${s.border} ${s.bg}`}>
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${s.rail} to-transparent`} aria-hidden />
      <div className="px-5 py-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={`mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${s.pill}`}>{s.label}</span>
          <p className="text-sm text-neutral-200 min-w-0">
            <code className={`mono ${verdict === 'in' ? 'text-emerald-300' : verdict === 'out' ? 'text-amber-300' : 'text-neutral-300'}`}>{domain}</code>{' '}
            {verdict === 'in' && (
              <span className="text-neutral-400">
                covers <span className="mono text-neutral-100 tabular-nums">{inScopePrograms}</span> program{inScopePrograms === 1 ? '' : 's'}
                {outOfScopePrograms > 0 && (
                  <>
                    {' · '}
                    <span className="mono text-amber-300 tabular-nums">{outOfScopePrograms}</span> list it out-of-scope
                  </>
                )}
              </span>
            )}
            {verdict === 'out' && (
              <span className="text-neutral-400">
                is out-of-scope in <span className="mono text-neutral-100 tabular-nums">{outOfScopePrograms}</span> program{outOfScopePrograms === 1 ? '' : 's'}. Do not test.
              </span>
            )}
            {verdict === 'none' && <span className="text-neutral-400">is not listed by any indexed program</span>}
          </p>
        </div>

        {matches.length > 0 && (
          <ul className="mt-3">
            {matches.map((m) => (
              <MatchRow key={`${m.id}-${m.inScope}`} match={m} />
            ))}
          </ul>
        )}

        <div className="mt-3">
          {verdict === 'none' ? (
            <Link href="/programs" className="mono text-xs text-emerald-300 hover:text-emerald-200 transition focus-ring rounded">
              browse the index →
            </Link>
          ) : (
            <Link href={`/scope/${encodeURIComponent(domain)}`} className="mono text-xs text-emerald-300 hover:text-emerald-200 transition focus-ring rounded">
              full breakdown →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: HeroScopeMatch }) {
  const glyph = match.inScope ? '+' : '−';
  const glyphColor = match.inScope ? 'text-emerald-400' : 'text-amber-400';
  return (
    <li>
      <Link
        href={`/programs/${match.platform}/${match.slug}`}
        className="flex items-center gap-2.5 px-2 py-1.5 -mx-2 rounded-md hover:bg-neutral-900/60 transition group focus-ring"
      >
        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${PLATFORM_META[match.platform]?.dot ?? 'bg-neutral-500'}`} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="text-sm text-neutral-200 group-hover:text-emerald-300 transition truncate block">{match.name}</span>
          <code className="mono text-[11px] text-neutral-500 truncate block">
            <span className={`${glyphColor} mr-0.5`}>{glyph}</span>
            {match.identifier}
          </code>
        </span>
        <span className="mono text-xs text-neutral-300 tabular-nums shrink-0">
          {formatBounty(match.maxBounty, match.currency ?? 'USD')}
        </span>
      </Link>
    </li>
  );
}
