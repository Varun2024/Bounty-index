import Link from 'next/link';
import { stats, topPayouts, recentlyAdded, trendingNewPayouts } from '@/lib/db/queries';
import { formatBounty, platformLabel, PLATFORM_META, relativeTime } from '@/lib/format';
import { Ticker } from '@/app/_ui/ticker';
import { Tilt } from '@/app/_ui/tilt';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [s, top, recent, trending] = await Promise.all([
    stats().catch(() => null),
    topPayouts(5).catch(() => []),
    recentlyAdded(8, 14).catch(() => []),
    trendingNewPayouts(6, 30).catch(() => []),
  ]);

  return (
    <>
      <Hero s={s} top={top} />
      <Ticker />
      <HowItWorks />
      <SectionOrnament />
      <Pulse recent={recent} trending={trending} />
      <SectionOrnament />
      <Comparison />
      <SectionOrnament />
      <Features s={s} />
      <FinalCTA s={s} />
    </>
  );
}

// ---------- Hero ----------

interface HeroProps {
  s: Awaited<ReturnType<typeof stats>> | null;
  top: Awaited<ReturnType<typeof topPayouts>>;
}

function Hero({ s, top }: HeroProps) {
  const topBounty = s && top[0]?.maxBounty ? `$${top[0].maxBounty.toLocaleString()}` : null;
  return (
    <div className="relative overflow-hidden lg:min-h-[calc(100vh-3.5rem)]">
      <div className="parallax-slow absolute inset-0"><BackdropGrid /></div>
      <div className="parallax-fast absolute inset-0"><BackdropGlow /></div>

      <div className="relative max-w-[1200px] mx-auto px-6 flex flex-col min-h-full">
        <div className="flex-1 flex flex-col items-center justify-center text-center py-24 lg:py-20">
          <section className="max-w-3xl animate-[fadeUp_.7s_ease-out_both]">
            <h1 className="text-5xl md:text-6xl xl:text-[5.5rem] font-semibold tracking-[-0.035em] leading-[0.95] text-neutral-50">
              Bounties,{' '}
              <em className="not-italic whitespace-nowrap bg-gradient-to-br from-emerald-300 via-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                live-indexed.
              </em>
            </h1>

            <p className="mt-10 text-base md:text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed">
              {s ? (
                <>
                  <span className="mono text-neutral-100 tabular-nums">{s.programs.toLocaleString()}</span> public programs
                  across five platforms — filtered by scope, asset type, and payout.
                  {topBounty && (
                    <>
                      {' '}Top of the leaderboard: <span className="mono text-emerald-300 tabular-nums">{topBounty}</span>.
                    </>
                  )}
                </>
              ) : (
                'Public programs from HackerOne, Bugcrowd, Intigriti, YesWeHack and Federacy — filtered by scope, asset type, and payout.'
              )}
            </p>

            <div className="mt-10 flex flex-wrap gap-3 justify-center">
              <Link
                href="/programs"
                className="cta-arrow mono text-sm px-5 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition shadow-[0_0_50px_-8px] shadow-emerald-400/70 focus-ring"
              >
                browse programs <span className="arrow">→</span>
              </Link>
              <Link
                href="/scope-lookup"
                className="mono text-sm px-5 py-2.5 border border-neutral-800 bg-neutral-950/60 rounded-md hover:border-neutral-600 hover:bg-neutral-900 transition"
              >
                check a domain
              </Link>
            </div>
          </section>

          {top.length > 0 && (
            <div className="mt-16 w-full max-w-4xl animate-[fadeUp_.9s_ease-out_.15s_both]">
              <TopPayoutsPanel top={top} />
            </div>
          )}
        </div>

        {s && (
          <div className="pb-12 pt-10 border-t border-neutral-900/70 animate-[fadeUp_1.1s_ease-out_.3s_both]">
            <dl className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-6 text-left">
              <Stat label="Programs" value={s.programs.toLocaleString()} />
              <Stat label="Paying bounties" value={s.bountyPrograms.toLocaleString()} accent />
              <Stat label="In-scope assets" value={s.inScopeAssets.toLocaleString()} />
              <Stat label="Platforms" value={String(s.platforms)} />
              <Stat label="Ingest" value={relativeTime(s.lastIngestAt)} muted />
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function TopPayoutsPanel({ top }: { top: Awaited<ReturnType<typeof topPayouts>> }) {
  return (
    <div className="relative">
      {/* Glow rim behind the frame */}
      <div className="absolute -inset-4 pointer-events-none rounded-2xl bg-gradient-to-br from-emerald-400/10 via-transparent to-transparent blur-2xl opacity-70" />

      <div className="relative border border-neutral-800 bg-neutral-950/80 rounded-xl backdrop-blur-md overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-900 bg-neutral-950/90">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-800 border border-neutral-700" />
          </div>
          <div className="flex-1 mono text-[10px] text-neutral-500 truncate px-2 py-1 bg-neutral-900/60 border border-neutral-900 rounded text-center">
            bounty.index/programs?sort=reward
          </div>
        </div>

        <div className="absolute inset-x-0 top-[38px] h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

        <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-neutral-900 gap-2">
          <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest min-w-0">
            <span className="text-neutral-600">§</span>
            <span className="text-emerald-400 tabular-nums">TOP · 05</span>
            <span className="text-neutral-500 truncate">payouts · right now</span>
          </div>
          <Link href="/programs?sort=reward" className="mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-emerald-400 transition">
            all →
          </Link>
        </div>
        <ol>
        {top.map((p, i) => (
          <li key={p.id} className={i === top.length - 1 ? '' : 'border-b border-neutral-900'}>
            <Link
              href={`/programs/${p.platform}/${p.slug}`}
              className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3 md:py-3.5 hover:bg-neutral-900/60 active:bg-neutral-900/80 transition group"
            >
              <span className="mono text-[10px] text-neutral-600 w-4 tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}</span>
              <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-neutral-100 truncate group-hover:text-emerald-400 transition">{p.name}</p>
                <p className="mono text-[11px] text-neutral-500 mt-0.5">{platformLabel(p.platform)}</p>
              </div>
              <p className="mono text-sm md:text-base text-neutral-100 shrink-0 tabular-nums font-medium">
                {formatBounty(p.maxBounty, p.currency ?? 'USD')}
              </p>
            </Link>
          </li>
        ))}
      </ol>
      </div>
    </div>
  );
}

// ---------- How it works · asymmetric zigzag ----------

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Aggregate.',
      body: 'Every public program from five platforms pulled hourly into a single normalized index. HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy.',
      note: 'source · arkadiyt/bounty-targets-data',
    },
    {
      n: '02',
      title: 'Filter.',
      body: 'Platform, asset type (wildcard, API, mobile, hardware, source), minimum payout tier, and full-text scope search. Chip-based. URL is the state.',
      note: 'scan-heavy · not click-heavy',
    },
    {
      n: '03',
      title: 'Hunt.',
      body: 'Open a program to see full in-scope + out-of-scope lists with severity notes. Jump straight to the platform to submit.',
      note: '/ to search · j k ↵',
    },
  ];
  return (
    <section className="border-t border-neutral-900">
      <div className="max-w-[1200px] mx-auto px-6 py-28">
        <div className="reveal">
          <SectionEyebrow n="01" label="Workflow" />
          <h2 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight text-neutral-50 max-w-2xl">
            Three steps.<br />
            <span className="text-neutral-500">Zero platform-hopping.</span>
          </h2>
        </div>

        <div className="relative mt-20">
          {/* Connecting hairline */}
          <div className="absolute left-1/2 top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-neutral-800 to-transparent hidden md:block" />

          <div className="space-y-16 md:space-y-24">
            {steps.map((step, i) => {
              const rightAligned = i % 2 === 1;
              return (
                <div
                  key={step.n}
                  className={`grid md:grid-cols-2 gap-6 md:gap-16 items-center ${rightAligned ? '' : ''}`}
                >
                  <div className={rightAligned ? 'md:col-start-2 md:pl-16' : 'md:pr-16'}>
                    <div className="flex items-baseline gap-3 mb-4">
                      <span className="mono text-5xl md:text-6xl text-neutral-800 tabular-nums font-semibold">{step.n}</span>
                      <span className="mono text-[10px] uppercase tracking-widest text-neutral-600">step</span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-50">{step.title}</h3>
                    <p className="text-neutral-400 mt-4 max-w-md leading-relaxed">{step.body}</p>
                    <p className="mono text-[11px] text-neutral-500 mt-5 pt-4 border-t border-neutral-900 max-w-md">
                      <span className="text-neutral-700">{'// '}</span>
                      {step.note}
                    </p>
                  </div>
                  <div className={rightAligned ? 'md:col-start-1 md:row-start-1' : ''}>
                    <StepVisual index={i} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function StepVisual({ index }: { index: number }) {
  if (index === 0) return <AggregateDiagram />;
  if (index === 1) return <FilterDiagram />;
  return <HuntDiagram />;
}

function FilterDiagram() {
  return (
    <div className="relative border border-neutral-900 rounded-xl bg-neutral-950/60 aspect-[4/3] overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />
      <p className="absolute top-4 left-5 mono text-[10px] uppercase tracking-widest text-neutral-600">$ filter</p>
      <p className="absolute top-4 right-5 mono text-[10px] uppercase tracking-widest text-emerald-400 tabular-nums">→ 42</p>

      <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="flow2" x1="0" x2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[70, 130, 190, 250].map((y, i) => (
          <g key={y}>
            <path d={`M 50 ${y} L 280 ${y}`} stroke="#1f1f22" strokeWidth="1" />
            <path
              d={`M 50 ${y} L 280 ${y}`}
              stroke="url(#flow2)"
              strokeWidth="1.5"
              strokeDasharray="8 200"
              style={{ animation: `dash 5s linear infinite`, animationDelay: `${i * 0.3}s` }}
            />
          </g>
        ))}
        <rect x="285" y="60" width="90" height="200" rx="6" fill="#0a0a0b" stroke="#1f1f22" />
        <text x="330" y="90" textAnchor="middle" className="mono" fontSize="8" fill="#737373" letterSpacing="1">RESULTS</text>
        <line x1="295" y1="105" x2="365" y2="105" stroke="#1f1f22" />
        {[130, 155, 180, 205, 230].map((y, i) => (
          <g key={y}>
            <circle cx="303" cy={y} r="2" fill={i < 2 ? '#34d399' : '#737373'} />
            <rect x="313" y={y - 4} width={i < 2 ? 44 : 34} height="8" rx="2" fill={i < 2 ? '#34d39926' : '#171717'} />
          </g>
        ))}
      </svg>

      <div className="absolute bottom-5 left-5 flex flex-wrap gap-1.5 mono text-[10px] max-w-[42%]">
        {['bugcrowd ×', 'wildcard ×', '$10k+ ×'].map((c) => (
          <span key={c} className="px-1.5 py-0.5 border border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300 rounded">
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function HuntDiagram() {
  return (
    <div className="relative border border-neutral-900 rounded-xl bg-neutral-950/60 aspect-[4/3] overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />
      <p className="absolute top-4 left-5 mono text-[10px] uppercase tracking-widest text-neutral-600">$ open shopify</p>
      <span className="absolute top-4 right-5 mono text-[10px] uppercase tracking-widest text-emerald-400">↗ submit</span>

      <div className="absolute inset-x-6 top-14 bottom-6 rounded-lg border border-neutral-800 bg-neutral-950 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-neutral-900 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <span className="text-sm text-neutral-100 font-medium">Shopify</span>
          <span className="ml-auto mono text-[10px] text-emerald-300 tabular-nums">$50K</span>
        </div>
        <div className="p-4 space-y-2 mono text-[11px]">
          {[
            { g: '+', t: '*.shopify.com', l: 'wildcard' },
            { g: '+', t: 'api.shopify.com', l: 'api' },
            { g: '+', t: 'checkout.shopify.com', l: 'url' },
            { g: '−', t: 'community.shopify.com', l: 'out' },
          ].map((r) => (
            <div key={r.t} className="flex items-center gap-2">
              <span className={r.g === '+' ? 'text-emerald-400' : 'text-neutral-600'}>{r.g}</span>
              <span className="text-neutral-300 flex-1 truncate">{r.t}</span>
              <span className="text-neutral-600 text-[10px] uppercase tracking-widest">{r.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AggregateDiagram() {
  const platforms = [
    { key: 'hackerone', label: 'HackerOne', y: 40, count: 448 },
    { key: 'bugcrowd', label: 'Bugcrowd', y: 90, count: 242 },
    { key: 'intigriti', label: 'Intigriti', y: 140, count: 131 },
    { key: 'yeswehack', label: 'YesWeHack', y: 190, count: 62 },
    { key: 'federacy', label: 'Federacy', y: 240, count: 35 },
  ];
  const total = platforms.reduce((n, p) => n + p.count, 0);
  const dotHex: Record<string, string> = {
    hackerone: '#f87171',
    bugcrowd: '#fb923c',
    intigriti: '#34d399',
    yeswehack: '#38bdf8',
    federacy: '#a78bfa',
  };
  return (
    <div className="relative border border-neutral-900 rounded-xl bg-neutral-950/60 aspect-[4/3] overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />
      <p className="absolute top-4 left-5 mono text-[10px] uppercase tracking-widest text-neutral-600">$ ingest --all</p>
      <p className="absolute top-4 right-5 mono text-[10px] uppercase tracking-widest text-emerald-400 tabular-nums">
        Σ {total.toLocaleString()}
      </p>

      <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="flow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hub" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="70%" stopColor="#34d399" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
        </defs>

        {platforms.map((p, i) => (
          <g key={p.key}>
            <path
              d={`M 130 ${p.y} C 200 ${p.y}, 240 150, 300 150`}
              stroke="#1f1f22"
              strokeWidth="1"
              fill="none"
            />
            <path
              d={`M 130 ${p.y} C 200 ${p.y}, 240 150, 300 150`}
              stroke="url(#flow)"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="6 200"
              style={{
                animation: `dash 4s linear infinite`,
                animationDelay: `${i * 0.5}s`,
              }}
            />
          </g>
        ))}

        <circle cx="300" cy="150" r="42" fill="url(#hub)" />
        <circle cx="300" cy="150" r="18" fill="#0a0a0b" stroke="#34d399" strokeWidth="1" />
        <text x="300" y="146" textAnchor="middle" className="mono" fontSize="8" fill="#a3a3a3" letterSpacing="1">INDEX</text>
        <text x="300" y="160" textAnchor="middle" className="mono" fontSize="10" fill="#34d399" fontWeight="600">{total}</text>
      </svg>

      <ul className="absolute top-14 left-5 space-y-3 mono text-[11px]">
        {platforms.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotHex[p.key] }} />
            <span className="text-neutral-400 w-16">{p.label}</span>
            <span className="text-neutral-600 tabular-nums">+{p.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Pulse (Recently added + Trending) ----------

interface PulseProps {
  recent: Awaited<ReturnType<typeof recentlyAdded>>;
  trending: Awaited<ReturnType<typeof trendingNewPayouts>>;
}

function Pulse({ recent, trending }: PulseProps) {
  if (recent.length === 0 && trending.length === 0) return null;
  return (
    <section className="max-w-[1200px] mx-auto px-6 py-24">
      <div className="mb-12 flex items-end justify-between reveal">
        <div>
          <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-2">§ 03 · Pulse</p>
          <h2 className="text-3xl md:text-4xl font-semibold text-neutral-50 tracking-tight">What's moving now.</h2>
        </div>
        <Link
          href="/feed"
          className="hidden md:inline-flex cta-arrow mono text-xs text-neutral-500 hover:text-emerald-400 transition items-center gap-1.5"
        >
          full feed <span className="arrow">→</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 md:gap-8 items-start">
        <PulsePanel
          eyebrow="Recently added"
          hint="last 14 days"
          empty="No new programs indexed in the last 14 days."
        >
          {recent.map((p) => (
            <PulseRow key={p.id} p={p} showRelative />
          ))}
        </PulsePanel>

        <PulsePanel
          eyebrow="Top new payouts"
          hint="last 30 days"
          empty="No paying programs added recently."
        >
          {trending.map((p) => (
            <PulseRow key={p.id} p={p} showPayout />
          ))}
        </PulsePanel>
      </div>
    </section>
  );
}

interface PulsePanelProps {
  eyebrow: string;
  hint: string;
  empty: string;
  children: React.ReactNode;
}

function PulsePanel({ eyebrow, hint, empty, children }: PulsePanelProps) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div className="border border-neutral-900 rounded-xl bg-neutral-950/50 overflow-hidden reveal reveal-delay-1">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-900 bg-neutral-950/70">
        <p className="mono text-[10px] uppercase tracking-widest text-emerald-400">{eyebrow}</p>
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-600">{hint}</p>
      </div>
      {items.length === 0 ? (
        <div className="p-6 mono text-xs text-neutral-600">— {empty} —</div>
      ) : (
        <ul>{children}</ul>
      )}
    </div>
  );
}

interface PulseRowProps {
  p: Awaited<ReturnType<typeof recentlyAdded>>[number];
  showRelative?: boolean;
  showPayout?: boolean;
}

function PulseRow({ p, showRelative, showPayout }: PulseRowProps) {
  const dot = PLATFORM_META[p.platform]?.dot ?? 'bg-neutral-500';
  return (
    <li className="border-b border-neutral-900 last:border-b-0">
      <Link
        href={`/programs/${p.platform}/${p.slug}`}
        className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-900/40 transition group"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-neutral-100 group-hover:text-emerald-400 transition truncate">{p.name}</p>
          <p className="mono text-[11px] text-neutral-500 mt-0.5 truncate">
            {platformLabel(p.platform)}
            {p.offersBounty ? <span className="text-emerald-400/80"> · bounty</span> : <span className="text-neutral-600"> · vdp</span>}
          </p>
        </div>
        {showPayout && p.maxBounty ? (
          <span className="mono text-sm text-emerald-300 tabular-nums shrink-0">
            {formatBounty(p.maxBounty, p.currency ?? 'USD')}
          </span>
        ) : showRelative && p.firstSeenAt ? (
          <span className="mono text-[10px] uppercase tracking-widest text-neutral-500 shrink-0">
            {relativeTime(p.firstSeenAt)}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

// ---------- Comparison ----------

interface CompareRow {
  name: string;
  coverage: string;
  sort: string;
  lookup: string;
  keyboard: string;
  active?: boolean;
}

function Comparison() {
  const rows: CompareRow[] = [
    { name: 'bounty.index', coverage: '5 of 5 · unified', sort: '✓ max payout', lookup: '✓ one query', keyboard: '✓ / j k ↵', active: true },
    { name: 'HackerOne directory', coverage: '1 of 5', sort: 'severity only', lookup: '✗', keyboard: '✗' },
    { name: 'Bugcrowd programs page', coverage: '1 of 5', sort: '✓ max payout', lookup: '✗', keyboard: '✗' },
    { name: 'disclose.io', coverage: 'VDP policies only', sort: '✗', lookup: '✗', keyboard: '✗' },
    { name: 'bounty-targets-data', coverage: '5 of 5 · raw JSON', sort: 'grep + jq', lookup: 'grep + jq', keyboard: 'n/a' },
  ];
  return (
    <section className="border-t border-neutral-900 bg-neutral-950/40 relative">
      <div
        className="absolute pointer-events-none inset-0 opacity-30"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />
      <div className="relative max-w-[1200px] mx-auto px-6 py-28">
        <div className="reveal">
          <SectionEyebrow n="02" label="Why this exists" />
          <h2 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight text-neutral-50 max-w-3xl">
            Every alternative is <span className="text-neutral-500">fragmented.</span>
          </h2>
          <p className="mt-5 text-neutral-400 max-w-2xl leading-relaxed">
            Each platform shows its own programs. Directories are stale or policy-only. Raw JSON is fine
            if you enjoy <code className="mono text-neutral-300">jq</code>. This is the one built for scanning.
          </p>
        </div>

        {/* Mobile: card stack */}
        <div className="mt-10 md:hidden space-y-3">
          {rows.map((r) => (
            <div
              key={r.name}
              className={`relative border rounded-xl overflow-hidden ${
                r.active
                  ? 'border-emerald-400/40 bg-emerald-400/[0.04]'
                  : 'border-neutral-900 bg-neutral-950/60'
              }`}
            >
              {r.active && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400" />}
              <div className="px-4 py-3 border-b border-neutral-900 flex items-center gap-2">
                {r.active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                <span className={r.active ? 'text-emerald-300 font-medium' : 'text-neutral-100'}>{r.name}</span>
              </div>
              <dl className="divide-y divide-neutral-900 text-sm">
                {[
                  { k: 'Coverage', v: r.coverage },
                  { k: 'Sort by payout', v: r.sort },
                  { k: 'Scope lookup', v: r.lookup },
                  { k: 'Keyboard nav', v: r.keyboard },
                ].map((cell) => (
                  <div key={cell.k} className="flex items-center justify-between px-4 py-2.5">
                    <dt className="mono text-[10px] uppercase tracking-widest text-neutral-500">{cell.k}</dt>
                    <dd className={`mono text-xs ${cellColor(cell.v, r.active)}`}>{cell.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="mt-14 border border-neutral-900 rounded-xl overflow-hidden bg-neutral-950/60 hidden md:block">
          <div className="grid grid-cols-[1.5fr_1.2fr_1.2fr_1.2fr_1.2fr] mono text-[10px] uppercase tracking-widest text-neutral-500 border-b border-neutral-900 bg-neutral-950">
            <div className="px-5 py-3.5">Source</div>
            <div className="px-4 py-3.5">Coverage</div>
            <div className="px-4 py-3.5">Sort by payout</div>
            <div className="px-4 py-3.5">Scope lookup</div>
            <div className="px-5 py-3.5">Keyboard nav</div>
          </div>
          {rows.map((r) => (
            <div
              key={r.name}
              className={`grid grid-cols-[1.5fr_1.2fr_1.2fr_1.2fr_1.2fr] text-sm border-b border-neutral-900 last:border-b-0 ${
                r.active ? 'bg-emerald-400/[0.04] relative' : ''
              }`}
            >
              {r.active && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-400" />}
              <div className={`px-5 py-4 ${r.active ? 'text-emerald-300 font-medium' : 'text-neutral-100'}`}>
                {r.active ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {r.name}
                  </span>
                ) : (
                  r.name
                )}
              </div>
              <CompareCell value={r.coverage} active={r.active} />
              <CompareCell value={r.sort} active={r.active} />
              <CompareCell value={r.lookup} active={r.active} />
              <CompareCell value={r.keyboard} active={r.active} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function cellColor(value: string, active?: boolean): string {
  if (value.startsWith('✓')) return active ? 'text-emerald-300' : 'text-emerald-400/80';
  if (value === '✗') return 'text-neutral-700';
  return 'text-neutral-400';
}

function CompareCell({ value, active }: { value: string; active?: boolean }) {
  const isYes = value.startsWith('✓');
  const isNo = value === '✗';
  const cls = isYes
    ? active
      ? 'text-emerald-300'
      : 'text-emerald-400/80'
    : isNo
      ? 'text-neutral-700'
      : 'text-neutral-400';
  return <div className={`px-4 py-4 mono text-xs ${cls}`}>{value}</div>;
}

// ---------- Features · mismatched card weights ----------

function Features({ s }: { s: Awaited<ReturnType<typeof stats>> | null }) {
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

// ---------- Trust bar ----------

function TrustBar({ s }: { s: Awaited<ReturnType<typeof stats>> | null }) {
  return (
    <section className="border-t border-neutral-900 bg-neutral-950/60">
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mono text-xs text-neutral-500 justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
            <span>data · <a href="https://github.com/arkadiyt/bounty-targets-data" className="text-neutral-300 hover:text-emerald-400 transition">arkadiyt/bounty-targets-data</a></span>
            <span className="text-neutral-700">·</span>
            <span>MIT licensed</span>
            <span className="text-neutral-700">·</span>
            <span>updated hourly</span>
            <span className="text-neutral-700">·</span>
            <span>not affiliated with any platform</span>
          </div>
          {s?.lastIngestAt && <span className="text-neutral-400">last ingest {relativeTime(s.lastIngestAt)}</span>}
        </div>
      </div>
    </section>
  );
}

// ---------- Final CTA ----------

function FinalCTA({ s }: { s: Awaited<ReturnType<typeof stats>> | null }) {
  return (
    <section className="border-t border-neutral-900 relative overflow-hidden">
      <div
        className="absolute pointer-events-none inset-x-0 -bottom-40 h-80 opacity-30"
        style={{ background: 'radial-gradient(ellipse 60% 100% at 50% 100%, #34d399 0%, transparent 70%)' }}
      />
      <div className="relative max-w-[1200px] mx-auto px-6 py-28 text-center">
        <SectionEyebrow n="04" label="Start hunting" centered />
        <h2 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight text-neutral-50 max-w-3xl mx-auto leading-[1]">
          {s ? (
            <>
              <span className="mono text-emerald-300 tabular-nums">{s.bountyPrograms.toLocaleString()}</span> programs<br />
              are <span className="text-neutral-500">paying bounties</span><br />
              right now.
            </>
          ) : (
            'Start hunting.'
          )}
        </h2>
        <p className="text-neutral-400 mt-8 max-w-lg mx-auto">
          Filter the list, save an RSS, find the ones that fit your stack.
        </p>
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          <Link
            href="/programs?hasBounty=1&sort=reward"
            className="cta-arrow mono text-sm px-5 py-2.5 bg-emerald-400 text-neutral-950 rounded-md hover:bg-emerald-300 transition shadow-[0_0_50px_-8px] shadow-emerald-400/70 focus-ring"
          >
            browse paying programs <span className="arrow">→</span>
          </Link>
          <Link
            href="/scope-lookup"
            className="mono text-sm px-5 py-2.5 border border-neutral-800 bg-neutral-950/60 rounded-md hover:border-neutral-600 hover:bg-neutral-900 transition"
          >
            check a domain
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------- Bits ----------

function SectionOrnament() {
  return (
    <div className="relative h-0 pointer-events-none">
      <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3">
        <span className="block w-16 h-px bg-gradient-to-l from-neutral-800 to-transparent" />
        <span className="w-1.5 h-1.5 rotate-45 bg-emerald-400/60 shadow-[0_0_12px] shadow-emerald-400/60" />
        <span className="block w-16 h-px bg-gradient-to-r from-neutral-800 to-transparent" />
      </div>
    </div>
  );
}

interface SectionEyebrowProps {
  n: string;
  label: string;
  centered?: boolean;
}

function SectionEyebrow({ n, label, centered }: SectionEyebrowProps) {
  return (
    <p className={`mono text-[10px] uppercase tracking-widest flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
      <span className="text-neutral-700">§</span>
      <span className="text-emerald-400 tabular-nums">{n}</span>
      <span className="text-neutral-700">/</span>
      <span className="text-neutral-500">{label}</span>
    </p>
  );
}

interface StatProps {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}

function Stat({ label, value, accent, muted }: StatProps) {
  return (
    <div>
      <dt className="mono text-[10px] uppercase tracking-widest text-neutral-500">{label}</dt>
      <dd
        className={`text-xl md:text-2xl font-semibold mt-1.5 mono tabular-nums ${
          accent ? 'text-emerald-400' : muted ? 'text-neutral-400' : 'text-neutral-100'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function BackdropGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.4]"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.028) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 80% 55% at 40% 30%, black 30%, transparent 100%)',
      }}
    />
  );
}

function BackdropGlow() {
  return (
    <>
      <div
        className="absolute pointer-events-none -top-32 -left-20 w-[640px] h-[640px] rounded-full opacity-[0.22] blur-[130px]"
        style={{ background: 'radial-gradient(circle, #34d399 0%, transparent 60%)' }}
      />
      <div
        className="absolute pointer-events-none top-32 right-0 w-[560px] h-[560px] rounded-full opacity-[0.08] blur-[140px]"
        style={{ background: 'radial-gradient(circle, #34d399 0%, transparent 65%)' }}
      />
    </>
  );
}
