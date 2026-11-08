export interface ScrollResult {
  fps: number;
  frameMedianMs: number;
  frameP95Ms: number;
  frameMaxMs: number;
}

type Metric = keyof ScrollResult;

interface MetricDefinition {
  key: Metric;
  label: string;
  /** Whether a larger value is an improvement. */
  higherIsBetter: boolean;
  /** Whether this metric can fail the comparison. */
  gating: boolean;
}

export interface MetricComparison {
  label: string;
  base: number;
  head: number;
  /** Relative change, positive when head is worse than base. */
  regression: number;
  failed: boolean;
}

const metrics: MetricDefinition[] = [
  { key: 'fps', label: 'Scroll FPS', higherIsBetter: true, gating: true },
  { key: 'frameP95Ms', label: 'Frame time p95 (ms)', higherIsBetter: false, gating: true },
  { key: 'frameMedianMs', label: 'Frame time median (ms)', higherIsBetter: false, gating: false },
  { key: 'frameMaxMs', label: 'Frame time max (ms)', higherIsBetter: false, gating: false },
];

export const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const medianOf = (results: ScrollResult[], key: Metric) => median(results.map(result => result[key]));

/** Compares the median of each metric across runs; `threshold` is the tolerated relative regression (0.3 = 30%). */
export const compareResults = (base: ScrollResult[], head: ScrollResult[], threshold: number): MetricComparison[] =>
  metrics.map(({ key, label, higherIsBetter, gating }) => {
    const baseValue = medianOf(base, key);
    const headValue = medianOf(head, key);
    const change = (headValue - baseValue) / baseValue;
    const regression = higherIsBetter ? -change : change;
    return { label, base: baseValue, head: headValue, regression, failed: gating && regression > threshold };
  });

const formatPercent = (ratio: number) => `${ratio > 0 ? '+' : ''}${(ratio * 100).toFixed(1)}%`;

export const formatMarkdown = (comparisons: MetricComparison[], threshold: number, runs: number) => [
  '## Scroll benchmark: base vs head',
  '',
  `Median of ${runs} alternating runs on the same runner. Positive change means worse. Fails when FPS or p95 frame time regresses by more than ${formatPercent(threshold).replace('+', '')}.`,
  '',
  '| Metric | Base | Head | Change | |',
  '|---|---|---|---|---|',
  ...comparisons.map(({ label, base, head, regression, failed }) =>
    `| ${label} | ${base.toFixed(2)} | ${head.toFixed(2)} | ${formatPercent(regression)} | ${failed ? 'regression' : ''} |`),
  '',
].join('\n');
