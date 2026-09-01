import { stats } from '@/lib/db/queries';
import { PLATFORM_META } from '@/lib/format';
import { Tilt } from '@/app/_ui/tilt';
import { SectionEyebrow } from './shared';

interface FeaturesProps {
  s: Awaited<ReturnType<typeof stats>> | null;
}

export function Features({ s }: FeaturesProps) {
  return (
    <section className="border-t border-neutral-900">
      <div className="max-w-[1200px] mx-auto px-6 py-28">
        <div className="reveal">
          <SectionEyebrow n="03" label="What it does" />
          <h2 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight text-neutral-50 max-w-2xl">
            Four things.<br />
            <span className="text-neutral-500">Done properly.</span>
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-6 gap-4 [perspective:1200px]">
          {/* Big card — unified index */}
          <Tilt className="col-span-6 md:col-span-4 rounded-2xl">
          <div className="border border-neutral-900 rounded-2xl p-8 bg-neutral-950/40 hover:border-neutral-800 transition relative overflow-hidden group h-full">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
            <div className="flex items-start justify-between">
              <div className="max-w-md">
                <p className="mono text-[10px] uppercase tracking-widest text-emerald-400">01 · index</p>
                <h3 className="text-2xl font-semibold text-neutral-100 mt-3">Unified index</h3>
                <p className="text-neutral-400 mt-3 leading-relaxed">
                  One table. Five platforms. Sort by max reward, filter by asset type, jump to the highest
                  payouts first. {s ? `${s.bountyPrograms.toLocaleString()} of ${s.programs.toLocaleString()} pay in cash right now.` : ''}
                </p>
              </div>
              <code className="mono text-[11px] text-neutral-600 group-hover:text-emerald-400 transition shrink-0">
                /programs
              </code>
            </div>
            {/* Mini table preview */}
            <div className="mt-6 border border-neutral-900 rounded-lg bg-neutral-950/60 overflow-hidden">
              <div className="mono text-[10px] uppercase tracking-widest text-neutral-600 px-4 py-2 border-b border-neutral-900 flex justify-between">
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
          </Tilt>

          {/* Text-only medium card — scope lookup */}
          <Tilt className="col-span-6 md:col-span-2 rounded-2xl">
          <div className="border border-neutral-900 rounded-2xl p-8 bg-neutral-950/40 hover:border-neutral-800 transition group h-full">
            <p className="mono text-[10px] uppercase tracking-widest text-emerald-400">02 · lookup</p>
            <h3 className="text-2xl font-semibold text-neutral-100 mt-3">Scope lookup</h3>
            <p className="text-neutral-400 mt-3 leading-relaxed text-sm">
              Paste a domain. Instant verdict — in-scope somewhere, or not.
            </p>
            <div className="mt-8 mono text-xs">
              <p className="text-neutral-500">$ lookup tesla.com</p>
              <p className="text-emerald-300 mt-1">→ in scope · 2 programs</p>
            </div>
            <code className="mono text-[11px] text-neutral-600 group-hover:text-emerald-400 transition block mt-6">
              /scope-lookup
            </code>
          </div>
          </Tilt>

          {/* Small card — keyboard */}
          <Tilt className="col-span-6 md:col-span-2 rounded-2xl">
          <div className="border border-neutral-900 rounded-2xl p-8 bg-neutral-950/40 hover:border-neutral-800 transition group h-full">
            <p className="mono text-[10px] uppercase tracking-widest text-emerald-400">03 · nav</p>
            <h3 className="text-2xl font-semibold text-neutral-100 mt-3">Keyboard-first</h3>
            <div className="mt-6 flex flex-wrap gap-2 mono text-[11px]">
              {[
                { k: '/', d: 'search' },
                { k: 'j k', d: 'move' },
                { k: '↵', d: 'open' },
                { k: 'esc', d: 'blur' },
              ].map((x) => (
                <span key={x.k} className="inline-flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-300">{x.k}</kbd>
                  <span className="text-neutral-600">{x.d}</span>
                </span>
              ))}
            </div>
            <code className="mono text-[11px] text-neutral-600 group-hover:text-emerald-400 transition block mt-6">
              anywhere
            </code>
          </div>
          </Tilt>

          {/* Wide card — RSS */}
          <Tilt className="col-span-6 md:col-span-4 rounded-2xl">
          <div className="border border-neutral-900 rounded-2xl p-8 bg-neutral-950/40 hover:border-neutral-800 transition group h-full">
            <div className="flex items-start justify-between">
              <div className="max-w-md">
                <p className="mono text-[10px] uppercase tracking-widest text-emerald-400">04 · feed</p>
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
                <span className="text-emerald-300 text-[10px] uppercase tracking-widest">new</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-500">
                <span className="text-neutral-700">2026-08-03</span>
                <span className="text-neutral-300">Fireblocks MPC</span>
                <span className="text-emerald-300 text-[10px] uppercase tracking-widest">new</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-500">
                <span className="text-neutral-700">2026-08-02</span>
                <span className="text-neutral-300">Twilio</span>
                <span className="text-neutral-600 text-[10px] uppercase tracking-widest">scope+</span>
              </div>
            </div>
          </div>
          </Tilt>
        </div>
      </div>
    </section>
  );
}
