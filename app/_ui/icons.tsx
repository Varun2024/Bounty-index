interface IconProps {
  size?: number;
  className?: string;
}

// Inline SVG set. Stroke-based, currentColor, matches the mono/terminal aesthetic.
const base = (size: number, className: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true,
});

export function SearchIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function FilterIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

export function ExternalIcon({ size = 12, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M14 4h6v6M20 4 10 14M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function RssIcon({ size = 12, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function CommandIcon({ size = 12, className = '' }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6" />
    </svg>
  );
}
