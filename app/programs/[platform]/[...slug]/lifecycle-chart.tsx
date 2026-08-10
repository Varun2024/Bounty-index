import type { ProgramSnapshot } from '@/lib/db/queries';
import { diffSnapshots } from '@/lib/snapshots';

interface LifecycleChartProps {
  snapshots: ProgramSnapshot[]; // chronological, oldest → newest
}

const VIEWBOX_W = 800;
const VIEWBOX_H = 100;
const PAD_LEFT = 28;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const PLOT_W = VIEWBOX_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEWBOX_H - PAD_TOP - PAD_BOTTOM;

type EventKind = 'first' | 'add' | 'remove' | 'both' | 'reward' | 'quiet';

// Point fill for each event kind. Neutral for the baseline snapshot, emerald/amber for
// scope movement, cyan when the payout amount shifted, muted for a snapshot that carried
// no meaningful diff (rare — snapshots dedup by content hash).
const KIND_FILL: Record<EventKind, string> = {
  first: '#525252', // neutral-600
  add: '#34d399', // emerald-400
  remove: '#fbbf24', // amber-400
  both: '#34d399',
  reward: '#22d3ee', // cyan-400
  quiet: '#404040', // neutral-700
};

function classifyEvent(i: number, snapshots: ProgramSnapshot[]): EventKind {
  if (i === 0) return 'first';
  const diff = diffSnapshots(snapshots[i - 1].payload, snapshots[i].payload);
  if (!diff) return 'quiet';
  const added = diff.added.length > 0;
  const removed = diff.removed.length > 0;
  if (added && removed) return 'both';
  if (added) return 'add';
  if (removed) return 'remove';
  if (diff.rewardDelta) return 'reward';
  return 'quiet';
}

export function LifecycleChart({ snapshots }: LifecycleChartProps) {
  const firstMs = snapshots[0].capturedAt.getTime();
  const lastMs = snapshots[snapshots.length - 1].capturedAt.getTime();
  const timeSpan = Math.max(1, lastMs - firstMs); // avoid /0 if all snapshots share a timestamp

  const counts = snapshots.map((s) => s.payload.inScopeCount);
  const maxCount = Math.max(...counts, 1);
  const yTop = Math.ceil(maxCount * 1.15);

  const xAt = (ms: number) => PAD_LEFT + ((ms - firstMs) / timeSpan) * PLOT_W;
  const yAt = (count: number) => PAD_TOP + (1 - count / yTop) * PLOT_H;

  const points = snapshots.map((s, i) => ({
    x: xAt(s.capturedAt.getTime()),
    y: yAt(s.payload.inScopeCount),
    count: s.payload.inScopeCount,
    date: s.capturedAt,
    kind: classifyEvent(i, snapshots),
  }));

  // Build the connecting path. Single-point case is filtered upstream; assume >=2 here.
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_TOP + PLOT_H).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD_TOP + PLOT_H).toFixed(1)} Z`;

  const startLabel = snapshots[0].capturedAt.toISOString().slice(0, 10);
  const endLabel = snapshots[snapshots.length - 1].capturedAt.toISOString().slice(0, 10);
  const durationDays = Math.max(1, Math.round(timeSpan / (24 * 3600 * 1000)));

  return (
    <div className="mb-4 border border-neutral-900 rounded-lg bg-neutral-950/40 p-3">
      <div className="flex items-baseline justify-between mb-1.5 px-1">
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600">
          in-scope over <span className="text-neutral-300 tabular-nums">{durationDays}d</span>
        </span>
        <span className="mono text-[10px] uppercase tracking-widest text-neutral-600 tabular-nums">
          peak <span className="text-neutral-300">{maxCount}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        preserveAspectRatio="none"
        className="w-full h-24"
        role="img"
        aria-label={`In-scope asset count over ${durationDays} days, ${points.length} snapshots`}
      >
        {/* baseline */}
        <line
          x1={PAD_LEFT}
          y1={PAD_TOP + PLOT_H}
          x2={VIEWBOX_W - PAD_RIGHT}
          y2={PAD_TOP + PLOT_H}
          stroke="#171717"
          strokeWidth="1"
        />
        {/* y-max tick */}
        <text
          x={PAD_LEFT - 4}
          y={PAD_TOP + 4}
          fontSize="8"
          textAnchor="end"
          fill="#525252"
          fontFamily="ui-monospace, monospace"
        >
          {yTop}
        </text>
        <text
          x={PAD_LEFT - 4}
          y={PAD_TOP + PLOT_H + 3}
          fontSize="8"
          textAnchor="end"
          fill="#525252"
          fontFamily="ui-monospace, monospace"
        >
          0
        </text>
        {/* area fill */}
        <path d={areaPath} fill="#34d399" fillOpacity="0.06" />
        {/* line */}
        <path d={linePath} fill="none" stroke="#34d399" strokeOpacity="0.6" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.kind === 'first' || p.kind === 'quiet' ? 2.2 : 3}
            fill={KIND_FILL[p.kind]}
            stroke="#0a0a0a"
            strokeWidth="1"
          >
            <title>
              {p.date.toISOString().slice(0, 10)} · {p.count} in-scope · {labelFor(p.kind)}
            </title>
          </circle>
        ))}
        {/* x-axis labels */}
        <text
          x={PAD_LEFT}
          y={VIEWBOX_H - 6}
          fontSize="9"
          fill="#525252"
          fontFamily="ui-monospace, monospace"
        >
          {startLabel}
        </text>
        <text
          x={VIEWBOX_W - PAD_RIGHT}
          y={VIEWBOX_H - 6}
          fontSize="9"
          textAnchor="end"
          fill="#525252"
          fontFamily="ui-monospace, monospace"
        >
          {endLabel}
        </text>
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 px-1 mono text-[10px] text-neutral-600">
        <LegendDot color={KIND_FILL.first} label="first indexed" />
        <LegendDot color={KIND_FILL.add} label="scope added" />
        <LegendDot color={KIND_FILL.remove} label="scope removed" />
        <LegendDot color={KIND_FILL.reward} label="reward change" />
      </div>
    </div>
  );
}

function labelFor(kind: EventKind): string {
  switch (kind) {
    case 'first':
      return 'first indexed';
    case 'add':
      return 'scope added';
    case 'remove':
      return 'scope removed';
    case 'both':
      return 'scope added + removed';
    case 'reward':
      return 'reward change';
    case 'quiet':
      return 'metadata change';
  }
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
