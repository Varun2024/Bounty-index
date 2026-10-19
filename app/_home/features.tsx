import Link from 'next/link';
import { stats } from '@/lib/db/queries';
import { PLATFORM_META } from '@/lib/format';
import { Tilt } from '@/app/_ui/tilt';
import { SectionEyebrow } from './shared';

interface FeaturesProps {
  s: Awaited<ReturnType<typeof stats>> | null;
}

function AxisPreview({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-400">
      <span className="w-10">{label}</span>
      <div className="flex-1 h-1 bg-neutral-900 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// The four cards used to be display-only with a route hint. They're links now, so the
// hint is a real destination (R-26). The secondary directory below surfaces the features
// that previously lived only in the footer.
const MORE: { href: string; label: string; desc: string; beta?: boolean }[] = [
  { href: '/watchlist', label: 'Watchlist', desc: 'Pin programs and watch their scope move' },
  { href: '/compare', label: 'Compare', desc: 'Up to three programs, side by side' },
  { href: '/whats-new', label: "What's new", desc: 'A dated log of every scope change' },
  { href: '/reward-changes', label: 'Reward changes', desc: 'Payouts rising and falling over time' },
  { href: '/settings/discord', label: 'Discord alerts', desc: 'One webhook per program, no email' },
  { href: '/mcp', label: 'MCP server', desc: 'Query the index from Claude or Cursor', beta: true },
];

export function Features({ s }: FeaturesProps) {
  return (
    <section className="border-t border-neutral-900">
      <div className="max-w-[1200px] mx-auto px-6 py-28">
        <div className="reveal">
          <SectionEyebrow n="03" label="What it does" />
          <h2 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight text-neutral-50 max-w-2xl">
            Start with the index.<br />
            <span className="text-neutral-500">Then track, compare, and catch every scope change.</span>
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-6 gap-4 [perspective:1200px]">
          <Tilt className="col-span-6 md:col-span-4 rounded-2xl">
          <Link href="/programs" className="block h-full focus-ring rounded-2xl">
          <div className="border border-neutral-900 rounded-2xl p-8 bg-neutral-950/40 hover:border-neutral-800 transition relative overflow-hidden group h-full">
            <div className="flex items-start justify-between">
              <div className="max-w-md">
                <p className="text-sm text-emerald-300">Index</p>
                <h3 className="text-2xl font-semibold text-neutral-100 mt-3">Unified index</h3>
                <p className="text-neutral-400 mt-3 leading-relaxed">
                  One table. Six platforms. Sort by max reward or opportunity score, filter by asset type,
                  jump to the highest payouts first. {s ? `${s.bountyPrograms.toLocaleString()} of ${s.programs.toLocaleString()} pay in cash right now.` : ''}
                </p>
              </div>
              <code className="mono text-[11px] text-neutral-600 group-hover:text-emerald-400 transition shrink-0">
                /programs
              </code>
            </div>
            {/* Mini table preview */}
            <div className="mt-6 border border-neutral-900 rounded-lg bg-neutral-950/60 overflow-hidden">
              <div className="text-xs text-neutral-500 px-4 py-2 border-b border-neutral-900 flex justify-between">
                <span>Program</span>
                <span>Max reward</span>
              </div>
              {[
                { n: 'OpenSea', p: 'bugcrowd', v: '$3M' },
                { n: 'T-Mobile', p: 'bugcrowd', v: '$134K' },
                { n: 'Intel®', p: 'intigriti', v: '$100K' },
              ].map((r) => (
                <div key={r.n} className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-900 last:border-b-0">
                  <span className="text-sm text-neutral-200 inline-flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${PLATFORM_META[r.p]?.dot}`} />
                    {r.n}
                  </span>
                  <span className="mono text-sm text-neutral-100 tabular-nums">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
          </Link>
          </Tilt>

          <Tilt className="col-span-6 md:col-span-2 rounded-2xl">
          <Link href="/scope-lookup" className="block h-full focus-ring rounded-2xl">
          <div className="border border-neutral-900 rounded-2xl p-8 bg-neutral-950/40 hover:border-neutral-800 transition group h-full">
            <p className="text-sm text-emerald-300">Lookup</p>
            <h3 className="text-2xl font-semibold text-neutral-100 mt-3">Scope lookup</h3>
            <p className="text-neutral-400 mt-3 leading-relaxed text-sm">
              Paste a domain. Instant verdict: in-scope somewhere, or not.
            </p>
            <div className="mt-8 mono text-xs">
              <p className="text-neutral-500">$ /scope/tesla.com</p>
              <p className="text-emerald-300 mt-1">→ in scope · 2 programs</p>
            </div>
            <code className="mono text-[11px] text-neutral-600 group-hover:text-emerald-400 transition block mt-6">
              /scope/&lt;domain&gt;
            </code>
          </div>
          </Link>
          </Tilt>

          <Tilt className="col-span-6 md:col-span-2 rounded-2xl">
          <Link href="/how-scored" className="block h-full focus-ring rounded-2xl">
          <div className="border border-neutral-900 rounded-2xl p-8 bg-neutral-950/40 hover:border-neutral-800 transition group h-full">
            <p className="text-sm text-emerald-300">Score</p>
            <h3 className="text-2xl font-semibold text-neutral-100 mt-3">Opportunity score</h3>
            <p className="text-neutral-400 mt-3 leading-relaxed text-sm">
              A single 0–100 number. Payout, bounty vs VDP, freshness. The formula is public.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="mono text-4xl font-semibold text-emerald-300 tabular-nums leading-none">87</span>
              <div className="flex-1 space-y-1.5">
                <AxisPreview label="payout" pct={85} />
                <AxisPreview label="bounty" pct={100} />
                <AxisPreview label="fresh" pct={70} />
              </div>
            </div>
            <code className="mono text-[11px] text-neutral-600 group-hover:text-emerald-400 transition block mt-6">
              /how-scored
            </code>
          </div>
          </Link>
          </Tilt>

          <Tilt className="col-span-6 md:col-span-4 rounded-2xl">
          <Link href="/feed" className="block h-full focus-ring rounded-2xl">
          <div className="border border-neutral-900 rounded-2xl p-8 bg-neutral-950/40 hover:border-neutral-800 transition group h-full">
            <div className="flex items-start justify-between">
              <div className="max-w-md">
                <p className="text-sm text-emerald-300">Feed</p>
                <h3 className="text-2xl font-semibold text-neutral-100 mt-3">Log &amp; RSS</h3>
                <p className="text-neutral-400 mt-3 leading-relaxed text-sm">
                  New programs surface within an hour, grouped as a dated log. Subscribe by RSS or read the web view.
                </p>
              </div>
              <code className="mono text-[11px] text-neutral-600 group-hover:text-emerald-400 transition shrink-0">
                /feed
              </code>
            </div>
            <div className="mt-6 mono text-[11px] space-y-1.5">
              <div className="flex items-center gap-3 text-neutral-500">
                <span className="text-neutral-700">2026-08-03</span>
                <span className="text-neutral-300">OpenSea</span>
                <span className="text-emerald-300 text-[11px]">new</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-500">
                <span className="text-neutral-700">2026-08-03</span>
                <span className="text-neutral-300">Fireblocks MPC</span>
                <span className="text-emerald-300 text-[11px]">new</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-500">
                <span className="text-neutral-700">2026-08-02</span>
                <span className="text-neutral-300">Twilio</span>
                <span className="text-neutral-600 text-[11px]">scope+</span>
              </div>
            </div>
          </div>
          </Link>
          </Tilt>
        </div>

        {/* Secondary directory: the features that used to hide in the footer. Rendered as a
            two-column list, not a card grid, so it reads as an index and stays distinct from
            the four cards above (avoids a uniform card wall). gap-px over a neutral-900 base
            draws the dividers, so they stay correct at one column (mobile) and two (desktop)
            without per-cell border math. */}
        <div className="mt-6 border border-neutral-900 rounded-2xl bg-neutral-950/40 overflow-hidden">
          <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 px-6 pt-5 pb-4">
            And once you are hunting
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-neutral-900 border-t border-neutral-900">
            {MORE.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="group flex items-baseline justify-between gap-4 px-6 py-4 bg-background transition hover:bg-neutral-900/50 focus-ring"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm text-neutral-100 group-hover:text-emerald-300 transition">
                    {m.label}
                    {m.beta && (
                      <span className="mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-emerald-400/40 bg-emerald-400/[0.08] text-emerald-300">
                        beta
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-neutral-400 mt-0.5">{m.desc}</span>
                </span>
                <code className="mono text-[11px] text-neutral-600 group-hover:text-emerald-400 transition shrink-0">
                  {m.href}
                </code>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
