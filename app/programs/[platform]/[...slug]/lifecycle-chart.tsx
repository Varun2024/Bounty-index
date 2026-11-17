import type { ProgramSnapshot } from '@/lib/db/queries';
import { diffSnapshots } from '@/lib/snapshots';
import { CHART, CHART_STATUS } from '@/app/_ui/chart';
import { scaleTime, scaleLinear } from '@visx/scale';
import { LinePath, AreaClosed } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { Group } from '@visx/group';

interface LifecycleChartProps {
  snapshots: ProgramSnapshot[]; // chronological, oldest → newest
}

// Coordinate space. The SVG scales to its container width (preserveAspectRatio meet) so circles stay
// round and the curve keeps its shape — no client-side measuring, still server-rendered.
const W = 900;
const H = 160;
const M = { top: 16, right: 16, bottom: 30, left: 34 };
const X_MAX = W - M.left - M.right;
const Y_MAX = H - M.top - M.bottom;

const DAY_MS = 24 * 3600 * 1000;

type EventKind = 'first' | 'add' | 'remove' | 'both' | 'reward' | 'quiet';

// Point fill per event kind, from the shared chart vocabulary: accent for scope added, warn for
// removed, info when the payout amount shifted, muted axis-grey for the baseline snapshot, zero-grey
// for a snapshot that carried no meaningful diff.
const KIND_FILL: Record<EventKind, string> = {
  first: CHART.axis,
  add: CHART.accent,
  remove: CHART_STATUS.warn,
  both: CHART.accent,
  reward: CHART_STATUS.info,
  quiet: CHART.zero,
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
  const maxCount = Math.max(...snapshots.map((s) => s.payload.inScopeCount), 1);
  const yTop = Math.ceil(maxCount * 1.15);

  const xScale = scaleTime({
    domain: [new Date(firstMs), new Date(lastMs > firstMs ? lastMs : firstMs + 1)],
    range: [0, X_MAX],
  });
  const yScale = scaleLinear({ domain: [0, yTop], range: [Y_MAX, 0] });

  const points = snapshots.map((s, i) => ({
    date: s.capturedAt,
    count: s.payload.inScopeCount,
    kind: classifyEvent(i, snapshots),
  }));

  const startLabel = snapshots[0].capturedAt.toISOString().slice(0, 10);
  const endLabel = snapshots[snapshots.length - 1].capturedAt.toISOString().slice(0, 10);
  const durationDays = Math.max(1, Math.round((lastMs - firstMs) / DAY_MS));

  const axisLabel = { fontFamily: 'ui-monospace, monospace', fill: CHART.axis } as const;

  return (
    <div className="mb-4 border border-neutral-800 rounded-lg bg-neutral-950/40 p-3">
      <div className="flex items-baseline justify-between mb-1.5 px-1">
        <span className="mono text-[11px] uppercase tracking-widest text-neutral-400">
          in-scope over <span className="text-neutral-300 tabular-nums">{durationDays}d</span>
        </span>
        <span className="mono text-[11px] uppercase tracking-widest text-neutral-400 tabular-nums">
          peak <span className="text-neutral-300">{maxCount}</span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`In-scope asset count over ${durationDays} days, ${points.length} snapshots`}
      >
        <defs>
          {/* Area gradient: emerald near the line, fading to nothing at the baseline. */}
          <linearGradient id="lifecycleArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: CHART.accent, stopOpacity: 0.28 }} />
            <stop offset="100%" style={{ stopColor: CHART.accent, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <Group left={M.left} top={M.top}>
          {/* baseline + y ticks */}
          <line x1={0} y1={Y_MAX} x2={X_MAX} y2={Y_MAX} style={{ stroke: CHART.baseline }} strokeWidth={1} />
          <text x={-6} y={4} fontSize={9} textAnchor="end" style={axisLabel}>{yTop}</text>
          <text x={-6} y={Y_MAX + 3} fontSize={9} textAnchor="end" style={axisLabel}>0</text>

          {/* smooth area + line */}
          <AreaClosed
            data={points}
            x={(d) => xScale(d.date) ?? 0}
            y={(d) => yScale(d.count) ?? 0}
            yScale={yScale}
            curve={curveMonotoneX}
            fill="url(#lifecycleArea)"
          />
          <LinePath
            data={points}
            x={(d) => xScale(d.date) ?? 0}
            y={(d) => yScale(d.count) ?? 0}
            curve={curveMonotoneX}
            fill="none"
            strokeWidth={2}
            style={{ stroke: CHART.accent }}
          />

          {/* event points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={xScale(p.date) ?? 0}
              cy={yScale(p.count) ?? 0}
              r={p.kind === 'first' || p.kind === 'quiet' ? 2.6 : 3.4}
              strokeWidth={1.5}
              style={{ fill: KIND_FILL[p.kind], stroke: CHART.ring }}
            >
              <title>
                {p.date.toISOString().slice(0, 10)} · {p.count} in-scope · {labelFor(p.kind)}
              </title>
            </circle>
          ))}

          {/* x labels */}
          <text x={0} y={Y_MAX + 20} fontSize={10} style={axisLabel}>{startLabel}</text>
          <text x={X_MAX} y={Y_MAX + 20} fontSize={10} textAnchor="end" style={axisLabel}>{endLabel}</text>
        </Group>
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 px-1 mono text-[11px] text-neutral-400">
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
