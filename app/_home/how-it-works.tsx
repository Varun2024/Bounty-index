import { PlatformLogo } from '@/app/_ui/platform-logo';
import { Tilt } from '@/app/_ui/tilt';
import { SectionEyebrow } from './shared';

export function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Aggregate.',
      body: 'Every public program from five platforms pulled daily into a single normalized index. HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy.',
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
  const diagram = index === 0 ? <AggregateDiagram /> : index === 1 ? <FilterDiagram /> : <HuntDiagram />;
  return <Tilt className="rounded-xl">{diagram}</Tilt>;
}

function FilterDiagram() {
  return (
    <div className="relative border border-neutral-900 rounded-xl bg-neutral-950/60 aspect-[4/3] overflow-hidden hover:border-neutral-800 transition group">
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
    <div className="relative border border-neutral-900 rounded-xl bg-neutral-950/60 aspect-[4/3] overflow-hidden hover:border-neutral-800 transition group">
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
  return (
    <div className="relative border border-neutral-900 rounded-xl bg-neutral-950/60 aspect-[4/3] overflow-hidden hover:border-neutral-800 transition group">
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
          <li key={p.key} className="flex items-center gap-2.5">
            <PlatformLogo platform={p.key} size="md" />
            <span className="text-neutral-300 w-16">{p.label}</span>
            <span className="text-neutral-600 tabular-nums">+{p.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
