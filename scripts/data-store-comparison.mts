import { median } from './benchmark-comparison.mts';

export interface DataStoreResult {
  name: string;
  rows: number;
  medianMs: number;
}

export interface DataStoreComparison {
  name: string;
  rows: number;
  baseMs: number;
  headMs: number;
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
    .map(({ name }) => {
      const baseMs = median(valuesFor(base, name));
      const headMs = median(valuesFor(head, name));
      const regression = (headMs - baseMs) / baseMs;
      return { name, rows: largest, baseMs, headMs, regression, failed: regression > threshold && headMs - baseMs > minDifferenceMs };
    });
};

const formatPercent = (ratio: number) => `${ratio > 0 ? '+' : ''}${(ratio * 100).toFixed(1)}%`;

export const formatDataStoreMarkdown = (comparisons: DataStoreComparison[], threshold: number, runs: number, minDifferenceMs = DEFAULT_MIN_DIFFERENCE_MS) => [
  '## Data store benchmark: base vs head',
  '',
  `Median of ${runs} alternating runs on the same runner, at ${comparisons[0]?.rows} rows. Positive change means slower. Fails when a benchmark is more than ${formatPercent(threshold).replace('+', '')} slower and at least ${minDifferenceMs} ms slower.`,
  '',
  '| Benchmark | Base (ms) | Head (ms) | Change | |',
  '|---|---|---|---|---|',
  ...comparisons.map(comparison =>
    `| ${comparison.name} | ${comparison.baseMs.toFixed(2)} | ${comparison.headMs.toFixed(2)} | ${formatPercent(comparison.regression)} | ${comparison.failed ? 'regression' : ''} |`),
  '',
].join('\n');
