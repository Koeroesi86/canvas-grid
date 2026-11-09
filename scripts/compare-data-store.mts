import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  compareDataStore,
  DEFAULT_HEAP_THRESHOLD,
  DEFAULT_MIN_DIFFERENCE_MS,
  formatDataStoreMarkdown,
  type DataStoreResult,
} from './data-store-comparison.mts';

/**
 * Runs the data store benchmark against a base checkout and the current checkout, alternating
 * between them so runner noise affects both, then compares medians at each row count.
 *
 * Usage: node scripts/compare-data-store.mts <base-checkout-directory>
 * Environment: BENCHMARK_RUNS (default 5), DATA_STORE_THRESHOLD (default 0.2 = 20%),
 * DATA_STORE_HEAP_THRESHOLD (default 0.1 = 10%),
 * DATA_STORE_MIN_DIFFERENCE_MS (default 0.2), BENCH_ROWS (default 20000,100000).
 */
const [baseArgument] = process.argv.slice(2);
if (!baseArgument) throw new Error('Usage: node scripts/compare-data-store.mts <base-checkout-directory>');

const headRoot = resolve(import.meta.dirname, '..');
const baseRoot = resolve(baseArgument);
const runs = Number(process.env.BENCHMARK_RUNS ?? 5);
const threshold = Number(process.env.DATA_STORE_THRESHOLD ?? 0.2);
const heapThreshold = Number(process.env.DATA_STORE_HEAP_THRESHOLD ?? DEFAULT_HEAP_THRESHOLD);
const minDifferenceMs = Number(process.env.DATA_STORE_MIN_DIFFERENCE_MS ?? DEFAULT_MIN_DIFFERENCE_MS);
const outputDirectory = mkdtempSync(join(tmpdir(), 'data-store-benchmark-'));

// The harness always comes from head; only the components under test differ.
cpSync(join(headRoot, 'benchmarks'), join(baseRoot, 'benchmarks'), { recursive: true });
cpSync(join(headRoot, 'vitest.bench.config.mts'), join(baseRoot, 'vitest.bench.config.mts'));

const runBenchmark = (name: string, root: string, run: number): DataStoreResult[] => {
  const outputPath = join(outputDirectory, `${name}-${run}.json`);
  execFileSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.bench.config.mts'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, BENCH_ROWS: process.env.BENCH_ROWS ?? '20000,100000', DATA_STORE_OUTPUT: outputPath },
  });
  return JSON.parse(readFileSync(outputPath, 'utf8'));
};

const results = Array.from({ length: runs }).reduce<{ base: DataStoreResult[][]; head: DataStoreResult[][] }>((collected, _, run) => {
  const first = run % 2 === 0 ? 'base' : 'head';
  const second = first === 'base' ? 'head' : 'base';
  const roots = { base: baseRoot, head: headRoot };
  collected[first].push(runBenchmark(first, roots[first], run));
  collected[second].push(runBenchmark(second, roots[second], run));
  return collected;
}, { base: [], head: [] });

const comparisons = compareDataStore(results.base, results.head, threshold, minDifferenceMs, heapThreshold);
const markdown = formatDataStoreMarkdown(comparisons, threshold, runs, minDifferenceMs, heapThreshold);
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);

if (comparisons.some(comparison => comparison.failed)) {
  console.error('Data store performance regressed beyond the threshold.');
  process.exitCode = 1;
}
