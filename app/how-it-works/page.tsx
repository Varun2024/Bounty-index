import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How it works · Bounty Index',
  description:
    'The engineering pipeline behind bounty.index: how five bug bounty platforms are pulled, normalized, indexed, and delivered.',
};

interface Stage {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  detail: string;
}

const STAGES: Stage[] = [
  {
    key: 'extract',
    eyebrow: '01 · extract',
    title: 'Pull',
    body: 'Five platform JSONs fetched daily from arkadiyt/bounty-targets-data — HackerOne, Bugcrowd, Intigriti, YesWeHack, Federacy. One canonical upstream, no scraping.',
    detail: 'source · single mirror',
  },
  {
    key: 'normalize',
    eyebrow: '02 · normalize',
    title: 'Shape',
    body: 'Per-platform normalizers unify shape and asset types. Every ingest hashes the meaningful fields with SHA-256; unchanged programs skip a snapshot row.',
    detail: 'diff · sparse history',
  },
  {
    key: 'store',
    eyebrow: '03 · store',
    title: 'Index',
    body: 'Neon Postgres via Drizzle ORM with a lazy Proxy-based client. GIN + pg_trgm indexes on searchable text; JSONB payloads for snapshot history.',
    detail: 'similarity() ranked',
  },
  {
    key: 'deliver',
    eyebrow: '04 · deliver',
    title: 'Render',
    body: 'Next.js 16 App Router. Force-dynamic routes with per-route loading.tsx skeletons. Static assets on Vercel Edge, Vercel Analytics for real-user metrics.',
    detail: 'ttfb · sub-100ms',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 py-16 md:py-24">
      <header className="reveal">
        <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Under the hood</p>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-neutral-50 leading-[1.02]">
          How it&apos;s built.
        </h1>
        <p className="mt-6 text-neutral-400 text-lg max-w-2xl leading-relaxed">
          One quiet daily job, indexed for scan speed. Every public bounty program on five platforms flows through
          this pipeline into a single searchable index.
        </p>
      </header>

      <div className="mt-16 reveal reveal-delay-1">
        <PipelineDiagram />
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 reveal reveal-delay-2">
        {STAGES.map((s) => (
          <div
            key={s.key}
            className="border border-neutral-900 rounded-lg bg-neutral-950/50 p-5 hover:border-neutral-800 transition"
          >
            <p className="mono text-[10px] uppercase tracking-widest text-emerald-400/80">{s.eyebrow}</p>
            <h3 className="mt-3 text-lg font-semibold text-neutral-100 tracking-tight">{s.title}</h3>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{s.body}</p>
            <p className="mono text-[11px] text-neutral-500 mt-4 pt-3 border-t border-neutral-900">
              <span className="text-neutral-700">{'// '}</span>
              {s.detail}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-10 reveal reveal-delay-3">
        <StackCol title="Data" items={[
          ['arkadiyt/bounty-targets-data', 'upstream JSON mirror of five platforms'],
          ['SHA-256 content hashes', 'snapshot dedupe — sparse history'],
          ['program_snapshots', 'JSONB timeline per program'],
        ]} />
        <StackCol title="Runtime" items={[
          ['Vercel Cron', 'daily · 0 6 * * *'],
          ['Fluid Compute', 'reused function instances, graceful shutdown'],
          ['@vercel/analytics', 'real-user metrics'],
        ]} />
        <StackCol title="Storage" items={[
          ['Neon Postgres', 'lazy Drizzle client to survive build-time page-data collection'],
          ['pg_trgm GIN index', 'fuzzy search on program name + handle'],
          ['Drizzle ORM', 'typed queries; no runtime overhead'],
        ]} />
      </section>

      <div className="mt-16 pt-8 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-4">
        <p className="mono text-[11px] text-neutral-500 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
            Live index
          </span>
          <span className="text-neutral-800">·</span>
          <span>rebuilt every 24h</span>
          <span className="text-neutral-800">·</span>
          <span>MIT licensed</span>
        </p>
        <div className="flex items-center gap-3 mono text-xs">
          <a
            href="https://github.com/Varun2024/Bounty-index"
            target="_blank"
            rel="noreferrer noopener"
            className="cta-arrow text-emerald-400 hover:text-emerald-300 transition inline-flex items-center gap-1.5"
          >
            source ↗
          </a>
          <span className="text-neutral-800">·</span>
          <Link href="/programs" className="cta-arrow text-neutral-400 hover:text-neutral-100 transition inline-flex items-center gap-1.5">
            browse programs <span className="arrow">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

interface StackColProps {
  title: string;
  items: [string, string][];
}

function StackCol({ title, items }: StackColProps) {
  return (
    <div>
      <p className="mono text-[10px] uppercase tracking-widest text-neutral-500 mb-4">{title}</p>
      <ul className="space-y-4">
        {items.map(([name, desc]) => (
          <li key={name}>
            <p className="mono text-sm text-neutral-100">{name}</p>
            <p className="text-sm text-neutral-500 leading-relaxed mt-1">{desc}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PipelineDiagram() {
  return (
    <div className="relative border border-neutral-900 rounded-xl bg-neutral-950/60 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />
      <div className="absolute top-4 left-5 mono text-[10px] uppercase tracking-widest text-neutral-600">
        $ pipeline --trace
      </div>
      <div className="absolute top-4 right-5 mono text-[10px] uppercase tracking-widest text-emerald-400">● live</div>

      <svg viewBox="0 0 1200 320" className="w-full h-auto block" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <defs>
          <linearGradient id="pipeflow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="pipeglow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#34d399" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </radialGradient>
        </defs>

        <line x1="120" y1="160" x2="1080" y2="160" stroke="#1f1f22" strokeWidth="1" />
        <path
          d="M 120 160 L 1080 160"
          stroke="url(#pipeflow)"
          strokeWidth="2"
          strokeDasharray="14 220"
          style={{ animation: 'dash 6s linear infinite' }}
        />

        <g transform="translate(120,160)">
          <circle r="52" fill="url(#pipeglow)" />
          <rect x="-40" y="-52" width="80" height="104" rx="8" fill="#0a0a0b" stroke="#262629" />
          {[
            { y: -34, c: '#f87171', l: 'h1' },
            { y: -14, c: '#fb923c', l: 'bc' },
            { y: 6, c: '#34d399', l: 'ig' },
            { y: 26, c: '#38bdf8', l: 'ywh' },
            { y: 46, c: '#a78bfa', l: 'fed' },
          ].map((row) => (
            <g key={row.l}>
              <circle cx="-28" cy={row.y} r="3" fill={row.c} />
              <rect x="-18" y={row.y - 3} width="46" height="6" rx="1.5" fill="#171717" />
            </g>
          ))}
          <text y="-72" textAnchor="middle" className="mono" fontSize="10" fill="#737373" letterSpacing="1.4">
            EXTRACT
          </text>
        </g>

        <g transform="translate(440,160)">
          <circle r="52" fill="url(#pipeglow)" />
          <circle r="40" fill="#0a0a0b" stroke="#262629" />
          <circle r="40" fill="none" stroke="#34d399" strokeOpacity="0.35" strokeDasharray="3 6" />
          <line x1="0" y1="0" x2="0" y2="-24" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
          <line x1="0" y1="0" x2="18" y2="6" stroke="#a3a3a3" strokeWidth="1.5" strokeLinecap="round" />
          <circle r="2" fill="#34d399" />
          <text y="-64" textAnchor="middle" className="mono" fontSize="10" fill="#737373" letterSpacing="1.4">
            NORMALIZE
          </text>
          <text y="60" textAnchor="middle" className="mono" fontSize="9" fill="#525252" letterSpacing="1">
            0 6 * * *
          </text>
        </g>

        <g transform="translate(760,160)">
          <circle r="52" fill="url(#pipeglow)" />
          <g stroke="#262629" fill="#0a0a0b">
            <ellipse cx="0" cy="-24" rx="34" ry="9" />
            <path d="M -34 -24 L -34 24" strokeWidth="1" />
            <path d="M 34 -24 L 34 24" strokeWidth="1" />
            <ellipse cx="0" cy="24" rx="34" ry="9" />
            <ellipse cx="0" cy="-24" rx="34" ry="9" fill="#0f0f10" />
          </g>
          <ellipse cx="0" cy="-6" rx="34" ry="9" fill="none" stroke="#34d39955" />
          <ellipse cx="0" cy="10" rx="34" ry="9" fill="none" stroke="#34d39955" />
          <text y="-64" textAnchor="middle" className="mono" fontSize="10" fill="#737373" letterSpacing="1.4">
            STORE
          </text>
          <text y="60" textAnchor="middle" className="mono" fontSize="9" fill="#525252" letterSpacing="1">
            postgres · pg_trgm
          </text>
        </g>

        <g transform="translate(1080,160)">
          <circle r="52" fill="url(#pipeglow)" />
          <rect x="-46" y="-30" width="92" height="60" rx="6" fill="#0a0a0b" stroke="#262629" />
          <line x1="-46" y1="-16" x2="46" y2="-16" stroke="#262629" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={-38 + i * 8} cy={-23} r="1.6" fill="#3f3f46" />
          ))}
          {[
            { y: -6, w: 70, c: '#34d39966' },
            { y: 4, w: 40, c: '#262629' },
            { y: 14, w: 54, c: '#262629' },
          ].map((r) => (
            <rect key={r.y} x="-36" y={r.y} width={r.w} height="3" rx="1" fill={r.c} />
          ))}
          <text y="-56" textAnchor="middle" className="mono" fontSize="10" fill="#737373" letterSpacing="1.4">
            DELIVER
          </text>
          <text y="60" textAnchor="middle" className="mono" fontSize="9" fill="#525252" letterSpacing="1">
            next.js · edge
          </text>
        </g>
      </svg>
    </div>
  );
}
