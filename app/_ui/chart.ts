// The one chart vocabulary. Every chart on the site imports colors from here so they read as a
// single system instead of each file re-inventing hexes. SVG fill/stroke need literal color values
// (not Tailwind classes), so these are raw hex tuned for the dark surface (#0a0a0b).
//
// WCAG AA inside charts: muted text uses neutral-400 (#a3a3a3 → 7.85:1). neutral-500 (#737373,
// 4.17:1) and neutral-600 (#525252, 2.53:1) FAIL for the small text charts use and are banned here
// too — the site-wide sweep missed SVG `fill` attributes, which is how they crept back in.

export const CHART = {
  accent: '#34d399', // emerald-400 — the single brand accent: primary series, magnitude, "our data"
  accentSoft: 'rgba(52,211,153,0.07)', // area fill under an accent line
  accentMuted: 'rgba(52,211,153,0.35)', // de-emphasized accent (non-highlighted histogram bars)
  axis: '#a3a3a3', // neutral-400 — axis + tick + inline chart labels (AA-safe)
  grid: '#1a1a1d', // recessive gridlines (barely above the surface)
  baseline: '#262626', // neutral-800 — the zero baseline, a touch stronger than grid
  ring: '#0a0a0b', // page bg — 1px ring that separates overlapping/adjacent marks
  zero: '#2a2a2e', // fill for an empty/zero mark so a gap still reads as "zero", not "missing"
} as const;

// Status colors are reserved — they carry state (good/warn/bad/info) and are NEVER reused as a
// generic "series N". They always ship with a text label beside them, never color alone.
export const CHART_STATUS = {
  good: '#34d399', // emerald-400
  warn: '#fbbf24', // amber-400
  bad: '#f87171', // red-400
  info: '#22d3ee', // cyan-400
} as const;

// Categorical series ramp: the dataviz reference theme (dark mode), kept in its CVD-safe order.
// Assign hues to ENTITIES in a fixed order and never cycle — a 9th category folds into "Other"
// (CHART.axis), never a generated hue. Validated: `node scripts/validate_palette.js` passes every
// gate on this surface. Adjacent segments still get a 2px surface gap as secondary encoding.
export const CHART_SERIES = [
  '#3987e5', // blue
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // yellow
  '#d55181', // magenta
  '#008300', // green
  '#9085e9', // violet
  '#e66767', // red
] as const;
