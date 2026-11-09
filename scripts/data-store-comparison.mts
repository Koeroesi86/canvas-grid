import { median } from './benchmark-comparison.mts';

export interface DataStoreResult {
  name: string;
  rows: number;
  medianMs: number;
  /** Whether a regression fails the comparison; informational benchmarks are only reported. */
  gating: boolean;
  /** What `medianMs` holds when it is not a time in milliseconds (memory results are bytes per row). */
  unit?: 'bytes/row';
}

export interface DataStoreComparison {
  name: string;
  rows: number;
  gating: boolean;
  unit?: 'bytes/row';
  baseMs: number;
  headMs: number;
  /** Fastest and slowest run of each side, to show how noisy the median is. */
  baseRange: [number, number];
  headRange: [number, number];
  /** Relative change, positive when head is slower than base. */
  regression: number;
  failed: boolean;
}

/** Differences below this are timer and runner noise, however large they look relative to a sub-millisecond base. */
export const DEFAULT_MIN_DIFFERENCE_MS = 0.2;

/** Retained heap is deterministic (identical code measured identically in every run), so it gets a tight limit. */
export const DEFAULT_HEAP_THRESHOLD = 0.1;

/** Bytes per row below which a heap change is ignored. */
export const DEFAULT_MIN_HEAP_DIFFERENCE = 8;

/**
 * Compares the median of each benchmark's median time across runs, at every row count the runs contain
 * (costs that grow with the row count only show up at the larger ones).
 * `threshold` is the tolerated relative slowdown (0.3 = 30%), and a slowdown under `minDifferenceMs` never fails.
 * Heap results (`unit`) are compared the same way against `heapThreshold` and a floor in bytes per row.
 * A benchmark fails only if head's *fastest* run is slower than base's median by more than that, so one slow
 * run (a noisy neighbour, a GC pause) cannot fail it; a real slowdown makes every run slower.
 */
export const compareDataStore = (
  base: DataStoreResult[][],
  head: DataStoreResult[][],
  threshold: number,
  minDifferenceMs = DEFAULT_MIN_DIFFERENCE_MS,
  heapThreshold = DEFAULT_HEAP_THRESHOLD,
): DataStoreComparison[] => {
  const sizes = Array.from(new Set(head.flat().map(result => result.rows))).sort((a, b) => a - b);
  const valuesFor = (runs: DataStoreResult[][], rows: number, name: string) =>
    runs.flatMap(run => run.filter(result => result.rows === rows && result.name === name)).map(result => result.medianMs);

  return sizes.flatMap(rows => head[0]
    .filter(result => result.rows === rows)
    .map(({ name, gating, unit }) => {
      const baseValues = valuesFor(base, rows, name);
      const headValues = valuesFor(head, rows, name);
      const baseMs = median(baseValues);
      const headMs = median(headValues);
      const headBest = Math.min(...headValues);
      return {
        name,
        rows,
        gating,
        unit,
        baseMs,
        headMs,
        baseRange: [Math.min(...baseValues), Math.max(...baseValues)] as [number, number],
        headRange: [headBest, Math.max(...headValues)] as [number, number],
        regression: (headMs - baseMs) / baseMs,
        failed: gating && (headBest - baseMs) / baseMs > (unit ? heapThreshold : threshold) && headBest - baseMs > (unit ? DEFAULT_MIN_HEAP_DIFFERENCE : minDifferenceMs),
      };
    }));
};

const formatValue = (value: number, unit?: string) => (unit ? `${Math.round(value)}` : value.toFixed(2));

const formatRange = ([low, high]: [number, number], unit?: string) => `${formatValue(low, unit)}–${formatValue(high, unit)}`;

const formatPercent = (ratio: number) => `${ratio > 0 ? '+' : ''}${(ratio * 100).toFixed(1)}%`;

export const formatDataStoreMarkdown = (comparisons: DataStoreComparison[], threshold: number, runs: number, minDifferenceMs = DEFAULT_MIN_DIFFERENCE_MS, heapThreshold = DEFAULT_HEAP_THRESHOLD) => [
  '## Data store benchmark: base vs head',
  '',
  `Median of ${runs} alternating runs on the same runner, at ${Array.from(new Set(comparisons.map(comparison => comparison.rows.toLocaleString('en')))).join(' and ')} rows. Positive change means slower (or larger). Fails when even head's fastest run of a benchmark is more than ${formatPercent(threshold).replace('+', '')} and ${minDifferenceMs} ms slower than base's median. Ranges are the fastest and slowest run. Times are in ms; heap results are bytes per row and fail past ${formatPercent(heapThreshold).replace('+', '')}. Benchmarks marked info are reported but never fail.`,
  '',
  '| Rows | Benchmark | Base median (range) | Head median (range) | Change | |',
  '|---:|---|---|---|---|---|',
  ...comparisons.map(comparison => [
    comparison.rows.toLocaleString('en'),
    comparison.name,
    `${formatValue(comparison.baseMs, comparison.unit)} (${formatRange(comparison.baseRange, comparison.unit)})`,
    `${formatValue(comparison.headMs, comparison.unit)} (${formatRange(comparison.headRange, comparison.unit)})`,
    formatPercent(comparison.regression),
    comparison.failed ? 'regression' : (!comparison.gating && 'info') || '',
  ].join(' | ')).map(row => `| ${row} |`),
  '',
].join('\n');
