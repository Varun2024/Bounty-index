// Shared bits used by multiple landing sections. Extracted from the old monolithic page.tsx.

export function SectionOrnament() {
  // ponytail: removed per slop audit — gradient hairlines + colored shadow.
  // The section borders already carry the separation.
  return null;
}

interface SectionEyebrowProps {
  n: string;
  label: string;
  centered?: boolean;
}

export function SectionEyebrow({ n, label, centered }: SectionEyebrowProps) {
  void n;
  return (
    <p className={`text-sm text-neutral-500 ${centered ? 'text-center' : ''}`}>
      {label}
    </p>
  );
}

interface StatProps {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}

export function Stat({ label, value, accent, muted }: StatProps) {
  return (
    <div>
      <dt className="text-xs text-neutral-400">{label}</dt>
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

export function BackdropGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.5] [--grid-line:rgba(255,255,255,0.03)] [@media(prefers-color-scheme:light)]:[--grid-line:rgba(0,0,0,0.045)]"
      style={{
        backgroundImage:
          'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 80% 55% at 40% 30%, black 30%, transparent 100%)',
      }}
    />
  );
}

export function BackdropGlow() {
  // ponytail: aurora blobs removed per slop audit. Grid backdrop carries the atmosphere now.
  return null;
}
