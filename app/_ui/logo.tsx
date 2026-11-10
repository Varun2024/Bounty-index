interface LogoProps {
  size?: number;
  className?: string;
}

// The Scope Hound: a tracker that sniffs out bounties and watches scope move. Long droopy hound
// ears and a heavy muzzle, with an emerald nose (the catch, carrying the accent from the old
// target mark). Head/ears/eyes are currentColor so the nav can tint them; the nose is the single
// emerald accent. This line-icon is the small-size companion to the filled mascot illustration.
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
      {/* Ears */}
      <path
        d="M11.8 10.2 C6.8 10.5 5.2 16.6 6.8 22.4 C7.5 25 10.9 25 12.2 21.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeOpacity="0.92"
      />
      <path
        d="M20.2 10.2 C25.2 10.5 26.8 16.6 25.2 22.4 C24.5 25 21.1 25 19.8 21.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeOpacity="0.92"
      />
      {/* Head and muzzle */}
      <path
        d="M12 10.4 C12.4 6.8 19.6 6.8 20 10.4 C20.4 13.2 20 15.4 18.8 16.9 C18.4 19.8 18.7 22.6 16 23.3 C13.3 22.6 13.6 19.8 13.2 16.9 C12 15.4 11.6 13.2 12 10.4 Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* Eyes */}
      <circle cx="13.9" cy="12.9" r="1.1" fill="currentColor" />
      <circle cx="18.1" cy="12.9" r="1.1" fill="currentColor" />
      {/* Emerald nose: the catch */}
      <circle cx="16" cy="21.4" r="1.7" fill="#34d399" />
    </svg>
  );
}
