// The one chart vocabulary. Every chart on the site imports colors from here so they read as a
// single system instead of each file re-inventing hexes.
//
// Theme-aware: each token is a CSS variable (defined in globals.css for dark + light + the dark
// "stage" bands) with a dark-hex fallback for SSR safety. Because these are var() references they
// only resolve as CSS *properties*, so chart code applies them through `style={{ fill }}` /
// `style={{ background }}`, never as a raw SVG `fill="..."` presentation attribute (attributes do
// not parse var()). This is what lets a server-rendered chart recolor for light mode with no JS.
//
// WCAG AA inside charts: axis/label text uses --ck-axis, tuned to clear 4.5:1 on each surface
// (#a3a3a3 on the dark #0a0a0b, #78746b on the light paper/white). neutral-500/600 FAIL for the
// small text charts use and stay banned here.

export const CHART = {
  accent: 'var(--ck-accent, #34d399)', // the single brand accent: primary series, magnitude, "our data"
  accentSoft: 'var(--ck-accent-soft, rgba(52,211,153,0.07))', // area fill under an accent line
  accentMuted: 'var(--ck-accent-muted, rgba(52,211,153,0.35))', // de-emphasized accent (non-highlighted bars)
  axis: 'var(--ck-axis, #a3a3a3)', // axis + tick + inline chart labels (AA-safe on both surfaces)
  grid: 'var(--ck-grid, #1a1a1d)', // recessive gridlines (barely above the surface)
  baseline: 'var(--ck-baseline, #262626)', // the zero baseline, a touch stronger than grid
  ring: 'var(--ck-ring, #0a0a0b)', // surface-colored 1px ring that separates overlapping/adjacent marks
  zero: 'var(--ck-zero, #2a2a2e)', // fill for an empty/zero mark so a gap still reads as "zero", not "missing"
} as const;

// Status colors are reserved — they carry state (good/warn/bad/info) and are NEVER reused as a
// generic "series N". They always ship with a text label beside them, never color alone. Each is
// stepped per surface for >=3:1 contrast (lighter on dark, darker on light).
export const CHART_STATUS = {
  good: 'var(--ck-good, #34d399)',
  warn: 'var(--ck-warn, #fbbf24)',
  bad: 'var(--ck-bad, #f87171)',
  info: 'var(--ck-info, #22d3ee)',
} as const;

// Categorical series ramp: the dataviz reference theme, kept in its CVD-safe order. Assign hues to
// ENTITIES in a fixed order and never cycle — a 9th category folds into "Other" (CHART.axis), never
// a generated hue. Light and dark steps are both validated (node scripts/validate_palette.js); the
// light steps that dip under 3:1 on white ship with direct labels (the scope-mix legend), which is
// the relief rule. Adjacent segments still get a 2px surface gap as secondary encoding.
export const CHART_SERIES = [
  'var(--ck-s1, #3987e5)', // blue
  'var(--ck-s2, #d95926)', // orange
  'var(--ck-s3, #199e70)', // aqua
  'var(--ck-s4, #c98500)', // yellow
  'var(--ck-s5, #d55181)', // magenta
  'var(--ck-s6, #008300)', // green
  'var(--ck-s7, #9085e9)', // violet
  'var(--ck-s8, #e66767)', // red
] as const;
