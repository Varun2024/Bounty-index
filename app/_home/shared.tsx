// Shared bits used by multiple landing sections. Extracted from the old monolithic page.tsx.

export function SectionOrnament() {
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

export function BackdropGrid() {
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

export function BackdropGlow() {
  // ponytail: aurora blobs removed per slop audit. Grid backdrop carries the atmosphere now.
  return null;
}
