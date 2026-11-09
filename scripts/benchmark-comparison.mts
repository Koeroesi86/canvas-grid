export interface ScrollResult {
  fps: number;
  frameMedianMs: number;
  frameP95Ms: number;
  frameMaxMs: number;
  drawMeanMs: number;
  drawP95Ms: number;
  /** Frames that took longer than `STALL_FRAME_MS`. */
  stalledFrames: number;
}

/** A frame this slow is a visible stall (about three dropped frames at 60 fps). */
export const STALL_FRAME_MS = 50;

type Metric = keyof ScrollResult;

interface MetricDefinition {
  key: Metric;
  label: string;
  /** Whether a larger value is an improvement. */
  higherIsBetter: boolean;
  /** Whether this metric can fail the comparison. */
  gating: boolean;
  /** Counts are compared by difference, since a base of zero has no relative change. */
  absolute?: boolean;
}

export interface MetricComparison {
  label: string;
  base: number;
  head: number;
  /** Relative change (difference for absolute metrics), positive when head is worse than base. */
  regression: number;
  absolute: boolean;
  failed: boolean;
}

const metrics: MetricDefinition[] = [
  // Gating on time spent drawing: the frame rate is capped by the display and frame times come in multiples of a frame.
  { key: 'drawMeanMs', label: 'Draw time mean (ms)', higherIsBetter: false, gating: true },
  { key: 'drawP95Ms', label: 'Draw time p95 (ms)', higherIsBetter: false, gating: true },
  // One isolated spike is runner noise, so the allowance is a few extra stalled frames; sustained stalling still fails.
  { key: 'stalledFrames', label: `Stalled frames (>${STALL_FRAME_MS} ms)`, higherIsBetter: false, gating: true, absolute: true },
  { key: 'fps', label: 'Scroll FPS', higherIsBetter: true, gating: false },
  { key: 'frameP95Ms', label: 'Frame time p95 (ms)', higherIsBetter: false, gating: false },
  { key: 'frameMedianMs', label: 'Frame time median (ms)', higherIsBetter: false, gating: false },
  { key: 'frameMaxMs', label: 'Frame time max (ms)', higherIsBetter: false, gating: false },
];

export const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const medianOf = (results: ScrollResult[], key: Metric) => median(results.map(result => result[key]));

export const DEFAULT_STALL_ALLOWANCE = 2;

/**
 * Compares the median of each metric across runs. `threshold` is the tolerated relative regression (0.3 = 30%),
 * `stallAllowance` the tolerated increase in stalled frames.
 */
export const compareResults = (
  base: ScrollResult[],
  head: ScrollResult[],
  threshold: number,
  stallAllowance = DEFAULT_STALL_ALLOWANCE,
): MetricComparison[] =>
  metrics.map(({ key, label, higherIsBetter, gating, absolute = false }) => {
    const baseValue = medianOf(base, key);
    const headValue = medianOf(head, key);
    const difference = higherIsBetter ? baseValue - headValue : headValue - baseValue;
    const regression = absolute ? difference : difference / baseValue;
    const allowed = absolute ? stallAllowance : threshold;
    return { label, base: baseValue, head: headValue, regression, absolute, failed: gating && regression > allowed };
  });

const formatPercent = (ratio: number) => `${ratio > 0 ? '+' : ''}${(ratio * 100).toFixed(1)}%`;

const formatChange = ({ regression, absolute }: MetricComparison) =>
  absolute ? `${regression > 0 ? '+' : ''}${regression}` : formatPercent(regression);

export const formatMarkdown = (comparisons: MetricComparison[], threshold: number, runs: number, stallAllowance = DEFAULT_STALL_ALLOWANCE, renderer?: string) => [
  '## Scroll benchmark: base vs head',
  '',
  `Median of ${runs} alternating runs on the same runner. Positive change means worse. Fails when mean or p95 draw time regresses by more than ${formatPercent(threshold).replace('+', '')}, or when more than ${stallAllowance} extra frames stall.`,
  ...(renderer ? [`Renderer: ${renderer}${/swiftshader|llvmpipe|software/i.test(renderer) ? ' (software rasterisation: no GPU, so draw times are higher than on a real machine)' : ''}.`, ''] : []),
  '| Metric | Base | Head | Change | |',
  '|---|---|---|---|---|',
  ...comparisons.map(comparison =>
    `| ${comparison.label} | ${comparison.base.toFixed(2)} | ${comparison.head.toFixed(2)} | ${formatChange(comparison)} | ${comparison.failed ? 'regression' : ''} |`),
  '',
].join('\n');
