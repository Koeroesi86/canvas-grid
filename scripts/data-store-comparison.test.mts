import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareDataStore, formatDataStoreMarkdown, type DataStoreResult } from './data-store-comparison.mts';

const run = (update: number, setRows = 20): DataStoreResult[] => [
  { name: 'setRows', rows: 1000, medianMs: 1, gating: true },
  { name: 'setRows', rows: 20000, medianMs: setRows, gating: true },
  { name: 'update 1000 cells', rows: 20000, medianMs: update, gating: true },
  { name: 'hot cells', rows: 20000, medianMs: update, gating: false },
];

const find = (name: string, comparisons: ReturnType<typeof compareDataStore>, rows = 20000) => {
  const found = comparisons.find(comparison => comparison.name === name && comparison.rows === rows);
  assert.ok(found, `missing ${name}`);
  return found;
};

describe('compareDataStore', () => {
  it('compares every row count, smallest first', () => {
    const comparisons = compareDataStore([run(2)], [run(2)], 0.3);
    assert.deepEqual(comparisons.map(comparison => comparison.rows), [1000, 20000, 20000, 20000]);
  });

  it('fails a regression that only shows at the larger size', () => {
    const sizes = (small: number, large: number): DataStoreResult[] => [
      { name: 'remove', rows: 20000, medianMs: small, gating: true },
      { name: 'remove', rows: 100000, medianMs: large, gating: true },
    ];
    const comparisons = compareDataStore([sizes(1.7, 2)], [sizes(1.8, 6)], 0.3);
    assert.equal(find('remove', comparisons, 20000).failed, false);
    assert.equal(find('remove', comparisons, 100000).failed, true);
  });

  it('reports memory in bytes per row and never fails on it', () => {
    const heap = (bytes: number): DataStoreResult[] => [{ name: 'heap after setRows', rows: 20000, medianMs: bytes, gating: false, unit: 'bytes/row' }];
    const comparisons = compareDataStore([heap(200)], [heap(400)], 0.3);
    assert.equal(comparisons[0].failed, false);
    assert.match(formatDataStoreMarkdown(comparisons, 0.3, 1), /\| 20,000 \| heap after setRows \| 200 \(200–200\) \| 400 \(400–400\) \| \+100\.0% \| info \|/);
  });

  it('fails past the threshold when the slowdown is above the noise floor', () => {
    assert.equal(find('update 1000 cells', compareDataStore([run(2)], [run(2.5)], 0.3)).failed, false);
    assert.equal(find('update 1000 cells', compareDataStore([run(2)], [run(3)], 0.3)).failed, true);
  });

  it('ignores large relative slowdowns that are under the minimum difference', () => {
    assert.equal(find('update 1000 cells', compareDataStore([run(0.3)], [run(0.45)], 0.3)).failed, false);
    assert.equal(find('update 1000 cells', compareDataStore([run(0.3)], [run(0.6)], 0.3, 0.1)).failed, true);
  });

  it('does not fail on improvements', () => {
    const comparison = find('update 1000 cells', compareDataStore([run(10)], [run(1)], 0.3));
    assert.ok(comparison.regression < 0);
    assert.equal(comparison.failed, false);
  });

  it('uses the median across runs so one outlier does not decide', () => {
    const head = [run(2), run(50), run(2.1)];
    assert.equal(find('update 1000 cells', compareDataStore([run(2), run(2), run(2)], head, 0.3)).failed, false);
  });

  it('does not fail while head has a run as fast as base, even if the median is slower', () => {
    const head = [run(2), run(4), run(4.2)];
    const comparison = find('update 1000 cells', compareDataStore([run(2), run(2), run(2)], head, 0.3));
    assert.ok(comparison.regression > 0.3);
    assert.equal(comparison.failed, false);
  });

  it('fails when every head run is slower', () => {
    const head = [run(3.5), run(4), run(4.2)];
    assert.equal(find('update 1000 cells', compareDataStore([run(2), run(2), run(2)], head, 0.3)).failed, true);
  });

  it('never fails informational benchmarks', () => {
    const comparison = find('hot cells', compareDataStore([run(2)], [run(20)], 0.3));
    assert.ok(comparison.regression > 1);
    assert.equal(comparison.failed, false);
  });

  it('reports the fastest and slowest run of each side', () => {
    const comparison = find('update 1000 cells', compareDataStore([run(2), run(3)], [run(4), run(5), run(6)], 0.3));
    assert.deepEqual(comparison.baseRange, [2, 3]);
    assert.deepEqual(comparison.headRange, [4, 6]);
  });
});

describe('formatDataStoreMarkdown', () => {
  it('lists each benchmark and flags regressions', () => {
    const markdown = formatDataStoreMarkdown(compareDataStore([run(2)], [run(4)], 0.3), 0.3, 1);
    assert.match(markdown, /\| update 1000 cells \| 2\.00 \(2\.00–2\.00\) \| 4\.00 \(4\.00–4\.00\) \| \+100\.0% \| regression \|/);
    assert.match(markdown, /\| setRows \|/);
    assert.match(markdown, /\| hot cells \|.*\| info \|/);
  });
});
