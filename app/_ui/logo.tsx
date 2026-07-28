interface LogoProps {
  size?: number;
  className?: string;
}

// Crosshair/reticle mark — bounty = target. Emerald dot at center, geometric frame.
export function Logo({ size = 24, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="bounty.index"
    >
      {/* Outer frame — rounded square with corner cutouts */}
      <path
        d="M4 10V6a2 2 0 0 1 2-2h4M22 4h4a2 2 0 0 1 2 2v4M28 22v4a2 2 0 0 1-2 2h-4M10 28H6a2 2 0 0 1-2-2v-4"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Crosshairs */}
      <line x1="16" y1="7" x2="16" y2="12" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="20" x2="16" y2="25" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="16" x2="12" y2="16" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="16" x2="25" y2="16" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
      {/* Center — target hit */}
      <circle cx="16" cy="16" r="2.5" fill="#34d399" />
      <circle cx="16" cy="16" r="5.5" stroke="#34d399" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  );
}
