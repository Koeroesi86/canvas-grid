import { median } from './benchmark-comparison.mts';

export interface DataStoreResult {
  name: string;
  rows: number;
  medianMs: number;
  /** Whether a regression fails the comparison; informational benchmarks are only reported. */
  gating: boolean;
}

export interface DataStoreComparison {
  name: string;
  rows: number;
  gating: boolean;
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

/**
 * Compares the median of each benchmark's median time across runs, at the largest row count only
 * (smaller sizes are noisier and cannot regress without the largest one showing it).
 * `threshold` is the tolerated relative slowdown (0.3 = 30%), and a slowdown under `minDifferenceMs` never fails.
 * A benchmark fails only if head's *fastest* run is slower than base's median by more than that, so one slow
 * run (a noisy neighbour, a GC pause) cannot fail it; a real slowdown makes every run slower.
 */
export const compareDataStore = (
  base: DataStoreResult[][],
  head: DataStoreResult[][],
  threshold: number,
  minDifferenceMs = DEFAULT_MIN_DIFFERENCE_MS,
): DataStoreComparison[] => {
  const largest = Math.max(...head.flat().map(result => result.rows));
  const valuesFor = (runs: DataStoreResult[][], name: string) =>
    runs.flatMap(run => run.filter(result => result.rows === largest && result.name === name)).map(result => result.medianMs);

  return head[0]
    .filter(result => result.rows === largest)
    .map(({ name, gating }) => {
      const baseValues = valuesFor(base, name);
      const headValues = valuesFor(head, name);
      const baseMs = median(baseValues);
      const headMs = median(headValues);
      const headBest = Math.min(...headValues);
      return {
        name,
        rows: largest,
        gating,
        baseMs,
        headMs,
        baseRange: [Math.min(...baseValues), Math.max(...baseValues)],
        headRange: [headBest, Math.max(...headValues)],
        regression: (headMs - baseMs) / baseMs,
        failed: gating && (headBest - baseMs) / baseMs > threshold && headBest - baseMs > minDifferenceMs,
      };
    });
};

const formatRange = ([low, high]: [number, number]) => `${low.toFixed(2)}–${high.toFixed(2)}`;

const formatPercent = (ratio: number) => `${ratio > 0 ? '+' : ''}${(ratio * 100).toFixed(1)}%`;

export const formatDataStoreMarkdown = (comparisons: DataStoreComparison[], threshold: number, runs: number, minDifferenceMs = DEFAULT_MIN_DIFFERENCE_MS) => [
  '## Data store benchmark: base vs head',
  '',
  `Median of ${runs} alternating runs on the same runner, at ${comparisons[0]?.rows} rows. Positive change means slower. Fails when even head's fastest run of a benchmark is more than ${formatPercent(threshold).replace('+', '')} and ${minDifferenceMs} ms slower than base's median. Ranges are the fastest and slowest run. Benchmarks marked info are reported but never fail.`,
  '',
  '| Benchmark | Base median (range, ms) | Head median (range, ms) | Change | |',
  '|---|---|---|---|---|',
  ...comparisons.map(comparison => [
    comparison.name,
    `${comparison.baseMs.toFixed(2)} (${formatRange(comparison.baseRange)})`,
    `${comparison.headMs.toFixed(2)} (${formatRange(comparison.headRange)})`,
    formatPercent(comparison.regression),
    comparison.failed ? 'regression' : (!comparison.gating && 'info') || '',
  ].join(' | ')).map(row => `| ${row} |`),
  '',
].join('\n');
