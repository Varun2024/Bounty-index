# Design System

## Direction

**Editorial + terminal.** Linear × Warp × Vercel. Data-dense, monospace-first, dark by default, single-accent.
Not a SaaS dashboard, not a shadcn demo, not another cyberpunk hacker aesthetic.

Every section earns its space. Nothing is decorative-only.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#0a0a0b` | page bg |
| `--foreground` | `#e5e5e5` | body text |
| `--accent` | `#34d399` (emerald 400) | interactive, in-scope, primary CTA, hover, live signals |
| neutral-100 | `#f5f5f5` | headings, primary text |
| neutral-400 | `#a3a3a3` | secondary text, subhead within H1 |
| neutral-500 | `#737373` | metadata, timestamps, eyebrow labels |
| neutral-600 | `#525252` | tertiary text, `//` comments |
| neutral-700 | `#404040` | dividers (`·`, `/`) in eyebrow |
| neutral-800 | `#262626` | chip borders, kbd borders |
| neutral-900 | `#171717` | section dividers, card borders |
| amber-400 | `#fbbf24` | warnings only |
| platform dots | red-400/orange-400/emerald-400/sky-400/violet-400 | **exception** — informational only, for platform ID |

**Rule:** emerald is the only *accent*. Platform dots are informational, capped at ~6px, never used as fills. No other colors anywhere.

## Typography

- **Sans:** Geist Sans — headings, body, CTAs
- **Mono:** Geist Mono — identifiers, payouts, timestamps, kbd, filter chips, section eyebrows, code, terminals
- **The two-font rule is strict.** Anything the user would type or paste is mono; anything they'd read is sans. Drift breaks the identity.

### Scale

| Use | Class | Notes |
|---|---|---|
| Hero H1 (bright line) | `text-5xl md:text-6xl xl:text-[5.25rem]` | `tracking-[-0.035em]` `leading-[0.92]` |
| Hero H1 (muted line) | `text-4xl md:text-5xl xl:text-[4rem]` | `text-neutral-400` |
| Section H2 | `text-4xl md:text-5xl` | Two-line stacked with muted second line |
| Card H3 | `text-2xl` | `font-semibold` |
| Body | `text-base md:text-lg` | leading-relaxed for prose |
| Table row | `text-sm` | |
| Metadata mono | `text-xs` | |
| Eyebrow / label | `text-[10px] uppercase tracking-widest` | mono |
| Stat number | `text-xl md:text-2xl` | mono tabular-nums |

### Repeat-headline pacing (hero pattern)

Two stacked lines. First bright and definite. Second muted with a gradient hit on the operative phrase:

```
Find the bounty.               ← neutral-50, big
The bounty worth hunting.      ← neutral-400, smaller, gradient on "worth hunting"
```

Costs nothing. Feels designed.

## Composition patterns

### Section eyebrows — numbered

Every top-level section starts with:

```
§  01  /  WORKFLOW
```

Format: `<span text-neutral-700>§</span>  <span text-emerald-400 tabular-nums>01</span>  <span text-neutral-700>/</span>  <span text-neutral-500>LABEL</span>`

All-mono, `text-[10px] uppercase tracking-widest`. Numbers zero-padded. Instant editorial signal.

### Section H2 (two-line)

Bright first line. Muted second line as descriptive continuation:

```
Three steps.
Zero platform-hopping.
```

`<h2>` with a `<br />` between spans, second span `text-neutral-500`.

### Hero layout

- 12-column grid, `col-span-7 / col-span-5` on lg+
- Left: eyebrow → stacked H1 → paragraph (with inline data) → CTAs
- Right: data-in-hero panel (top-payouts, live counts, terminal readout)
- Bottom strip: stat bar with vertical rhythm break (`border-t`)
- Hero container: `lg:min-h-[calc(100vh-3.5rem)]` — one viewport moment, but not clipped

### Zigzag "how it works"

Odd steps left, even steps right, connected by a vertical hairline gradient. Each step has:
- Massive dim number (`text-6xl text-neutral-800`)
- H3 with terminal-flavored period (`Aggregate.`)
- Body prose
- `// comment-style` footnote below a hairline

Never use a symmetric 3-card grid for narrative steps. Zigzag reads as thought progression.

### Mismatched card weights (features)

Feature grid uses 6-col Tailwind subdivisions:
- one wide card (col-span-4) with embedded mini-preview (mini table, mini log, mini terminal)
- one medium card (col-span-2) with just prose + tiny terminal line
- one small card (col-span-2) with kbd inventory
- one wide card (col-span-4) with dated-log preview

Symmetric 2×2 or 4×1 grids feel templated. Mismatched grids feel designed.

### Comparison table

Row-per-alternative table with the winning row (yours) highlighted:
- Emerald-tinted background (`bg-emerald-400/[0.04]`)
- Left edge indicator (`w-0.5 bg-emerald-400` absolutely positioned)
- Emerald dot before name
- Emerald text on name

Never write "we're the best" — show the table.

### Live ticker

Horizontal marquee below the hero, `border-y border-neutral-900 bg-neutral-950/60`. CSS `@keyframes marquee` translating -50% over 60s. Left and right edges fade to bg with pointer-events-none masks.

Purpose: motion, product-in-view, freshness signal. Content: newest programs with platform dots + rewards.

## Component recipes

### Chip (filter, tag)

```
inactive: border-neutral-800 bg-neutral-900/50 text-neutral-400
active:   border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300
```
Always mono, `text-[11px]`, `px-2 py-1 rounded`.

### Kbd

```
px-1.5 py-0.5 border border-neutral-800 rounded text-neutral-300 mono
```

### Card (default)

```
border border-neutral-900 bg-neutral-950/40 rounded-xl p-8
hover: border-neutral-800 (subtle)
```

Big cards: `rounded-2xl p-8`. Small cards: `rounded-xl p-6`.

### Top-of-card hairline

Wide cards get a single-pixel emerald-fading gradient at the top:
```
<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
```

### Table

```
border border-neutral-900 rounded-lg overflow-hidden bg-neutral-950/40
header: bg-neutral-950 border-b, mono [10px] uppercase tracking-widest text-neutral-500
row: border-b border-neutral-900, hover: bg-neutral-900/50
active-row edge: absolute left-0 w-0.5 bg-emerald-400 (group-hover opacity)
```

### Primary CTA

```
mono text-sm px-5 py-2.5 bg-emerald-400 text-neutral-950 rounded-md
hover: bg-emerald-300
shadow: shadow-[0_0_50px_-8px] shadow-emerald-400/70
```

### Secondary CTA

```
mono text-sm px-5 py-2.5 border border-neutral-800 bg-neutral-950/60 rounded-md
hover: border-neutral-600 bg-neutral-900
```

## Atmosphere

- **Grid backdrop** on hero only: `linear-gradient` × 2 at 2.8% opacity, `56px 56px`, radial-mask to `ellipse 80% 55% at 40% 30%`
- **Radial emerald glow** on hero and final CTA: `radial-gradient(circle, #34d399, transparent)` at 6-22% opacity, `blur-[130px]`
- **Vertical hairlines** connecting zigzag steps: `bg-gradient-to-b from-transparent via-neutral-800 to-transparent`
- **Section dividers**: `border-t border-neutral-900` — no other visual noise between sections

Skip meshes, grain stacks, glassmorphism, illustrations.

## Motion

- **Reveal**: hero uses `animate-[fadeUp_.7s_ease-out_both]` with staggered `.15s` and `.30s` delays for left/right/stats
- **Marquee**: ticker uses `animate-[marquee_60s_linear_infinite]` — the only continuous motion on the page
- **Hover transitions**: `transition` (150ms) on color/border/bg only
- **Ping**: live badge on logo + hero eyebrow uses Tailwind `animate-ping` on an underlying dot

No scroll-triggered timelines, no parallax, no layout animations. One well-directed load sequence.

## Layout patterns

### Index (`/programs`)

Left rail 248px chip filters, main table right. Above table:
- Section eyebrow (§ 01 / THE INDEX) + H2 on left
- Total count + sort meta on right
- Active-filter chips row (removable, "N ACTIVE · clear all")

### Detail (`/programs/[p]/[s]`)

- Full-width mono breadcrumb `programs / ● Bugcrowd / tesla` with active leaf in emerald
- Hero: big name, one-line shell meta (`● Bugcrowd · 11 in-scope · 14 out · updated 3h ago`), primary "open program" CTA on right
- Tags row below hero
- Split columns: In scope (left, `+` glyphs in emerald) / Out of scope (right, `−` glyphs in muted)
- Zero-padded counts (`011`, `014`)

### Scope lookup

- Search input with mono `$` prompt prefix
- **Verdict panel** on submit: `IN SCOPE` or `NO MATCH` pill + full-sentence answer
- Matches list below with platform dots and `+ scope-identifier` mono

### Feed

- Date-gutter layout: `grid grid-cols-[92px_1fr]`
- Date + count in gutter, entries in right column
- Each entry: platform dot + name + platform + `NEW` pill + reward

## What we avoid

- Gradients other than the emerald radial glow and hero H1 `.bg-gradient-to-br` on gradient words
- Rounded-full pills for anything other than status dots and the LIVE badge
- Card grids with uniform shadows or uniform sizes
- Illustrations, hero SVGs, decorative blobs, mascots
- Emoji (except optional in `PLAN.md` phase markers)
- Any font other than Geist
- Light mode (Phase 2 minimum)
- Symmetric feature grids
- Scroll-triggered motion / parallax
- "We're the best" copy — always show the table

## Accessibility

- Contrast: neutral-400 on `#0a0a0b` = 7.4:1 ✅
- Live badge respects `prefers-reduced-motion` implicitly (Tailwind `animate-ping` can be gated at project level if needed)
- All interactive elements are real `<button>` / `<a>` / `<input>` — no `div onClick`
- Keyboard nav on `/programs` (`/`, `j/k`, `↵`, `esc`)

## Design references consulted

- **Linear** — numbered section headings, repeat-headline pacing, mismatched card weights
- **Warp** — terminal-block-as-hero, monospace-first, alternating alignment
- **Vercel** — single radial glow, data-as-hero, hairline gradient dividers
- **Raycast** — kbd chip affordances beside actions
- **Cursor** — terminal-shell metadata lines with `·` separators
- **Have I Been Pwned** — verdict-first empty/result states
