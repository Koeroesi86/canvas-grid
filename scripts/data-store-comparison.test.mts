import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareDataStore, formatDataStoreMarkdown, type DataStoreResult } from './data-store-comparison.mts';

const run = (update: number, setRows = 20): DataStoreResult[] => [
  { name: 'setRows', rows: 1000, medianMs: 1 },
  { name: 'setRows', rows: 20000, medianMs: setRows },
  { name: 'update 1000 cells', rows: 20000, medianMs: update },
];

const find = (name: string, comparisons: ReturnType<typeof compareDataStore>) => {
  const found = comparisons.find(comparison => comparison.name === name);
  assert.ok(found, `missing ${name}`);
  return found;
};

describe('compareDataStore', () => {
  it('compares only the largest row count', () => {
    const comparisons = compareDataStore([run(2)], [run(2)], 0.3);
    assert.deepEqual(comparisons.map(comparison => comparison.rows), [20000, 20000]);
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
});

describe('formatDataStoreMarkdown', () => {
  it('lists each benchmark and flags regressions', () => {
    const markdown = formatDataStoreMarkdown(compareDataStore([run(2)], [run(4)], 0.3), 0.3, 1);
    assert.match(markdown, /\| update 1000 cells \| 2\.00 \| 4\.00 \| \+100\.0% \| regression \|/);
    assert.match(markdown, /\| setRows \|/);
  });
});
