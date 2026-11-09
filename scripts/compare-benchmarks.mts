import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { compareResults, DEFAULT_STALL_ALLOWANCE, formatMarkdown, type ScrollResult } from './benchmark-comparison.mts';

/**
 * Runs the scroll benchmark against a base checkout and the current checkout, alternating
 * between them so runner noise affects both, then compares medians.
 *
 * Usage: node scripts/compare-benchmarks.mts <base-checkout-directory>
 * Environment: BENCHMARK_RUNS (default 5), BENCHMARK_THRESHOLD (default 0.25 = 25%),
 * BENCHMARK_STALL_ALLOWANCE (default 2: extra stalled frames tolerated)..
 */
const [baseArgument] = process.argv.slice(2);
if (!baseArgument) throw new Error('Usage: node scripts/compare-benchmarks.mts <base-checkout-directory>');

const headRoot = resolve(import.meta.dirname, '..');
const baseRoot = resolve(baseArgument);
const runs = Number(process.env.BENCHMARK_RUNS ?? 5);
const threshold = Number(process.env.BENCHMARK_THRESHOLD ?? 0.25);
const stallAllowance = Number(process.env.BENCHMARK_STALL_ALLOWANCE ?? DEFAULT_STALL_ALLOWANCE);
const outputDirectory = mkdtempSync(join(tmpdir(), 'scroll-benchmark-'));

// The harness always comes from head; only the components under test differ.
cpSync(join(headRoot, 'benchmarks/scroll'), join(baseRoot, 'benchmarks/scroll'), { recursive: true });

const runBenchmark = (name: string, root: string, run: number): ScrollResult & { renderer?: string } => {
  const outputPath = join(outputDirectory, `${name}-${run}.json`);
  execFileSync(process.execPath, [join(headRoot, 'benchmarks/scroll.bench.mts')], {
    cwd: headRoot,
    stdio: 'inherit',
    env: { ...process.env, SCROLL_ROOT: root, SCROLL_OUTPUT: outputPath },
  });
  return JSON.parse(readFileSync(outputPath, 'utf8'));
};

const results = Array.from({ length: runs }).reduce<{ base: (ScrollResult & { renderer?: string })[]; head: (ScrollResult & { renderer?: string })[] }>((collected, _, run) => {
  const first = run % 2 === 0 ? 'base' : 'head';
  const second = first === 'base' ? 'head' : 'base';
  const roots = { base: baseRoot, head: headRoot };
  collected[first].push(runBenchmark(first, roots[first], run));
  collected[second].push(runBenchmark(second, roots[second], run));
  return collected;
}, { base: [], head: [] });

const comparisons = compareResults(results.base, results.head, threshold, stallAllowance);
const markdown = formatMarkdown(comparisons, threshold, runs, stallAllowance, results.head[0]?.renderer);
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);

if (comparisons.some(comparison => comparison.failed)) {
  console.error('Scroll performance regressed beyond the threshold.');
  process.exitCode = 1;
}
