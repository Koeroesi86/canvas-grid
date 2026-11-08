import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareResults, formatMarkdown, median, type ScrollResult } from './benchmark-comparison.mts';

const result = (overrides: Partial<ScrollResult> = {}): ScrollResult => ({
  fps: 60,
  frameMedianMs: 16,
  frameP95Ms: 20,
  frameMaxMs: 30,
  ...overrides,
});

const find = (label: string, comparisons: ReturnType<typeof compareResults>) => {
  const found = comparisons.find(comparison => comparison.label === label);
  assert.ok(found, `missing ${label}`);
  return found;
};

describe('median', () => {
  it('handles odd and even counts', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
  });
});

describe('compareResults', () => {
  it('reports no regression for identical results', () => {
    const comparisons = compareResults([result()], [result()], 0.3);
    assert.ok(comparisons.every(comparison => comparison.regression === 0 && !comparison.failed));
  });

  it('treats lower FPS as a regression and higher FPS as an improvement', () => {
    assert.ok(find('Scroll FPS', compareResults([result()], [result({ fps: 30 })], 0.3)).regression > 0);
    assert.ok(find('Scroll FPS', compareResults([result()], [result({ fps: 90 })], 0.3)).regression < 0);
  });

  it('treats higher frame times as a regression', () => {
    assert.ok(find('Frame time p95 (ms)', compareResults([result()], [result({ frameP95Ms: 40 })], 0.3)).regression > 0);
  });

  it('fails only past the threshold', () => {
    assert.equal(find('Frame time p95 (ms)', compareResults([result()], [result({ frameP95Ms: 25 })], 0.3)).failed, false);
    assert.equal(find('Frame time p95 (ms)', compareResults([result()], [result({ frameP95Ms: 27 })], 0.3)).failed, true);
  });

  it('does not gate on non-gating metrics', () => {
    assert.equal(find('Frame time max (ms)', compareResults([result()], [result({ frameMaxMs: 300 })], 0.3)).failed, false);
  });

  it('uses the median across runs so one outlier does not decide', () => {
    const head = [result({ frameP95Ms: 20 }), result({ frameP95Ms: 200 }), result({ frameP95Ms: 21 })];
    assert.equal(find('Frame time p95 (ms)', compareResults([result()], head, 0.3)).failed, false);
  });
});

describe('formatMarkdown', () => {
  it('renders a row per metric and flags regressions', () => {
    const markdown = formatMarkdown(compareResults([result()], [result({ fps: 20 })], 0.3), 0.3, 1);
    assert.match(markdown, /\| Scroll FPS \| 60\.00 \| 20\.00 \| \+66\.7% \| regression \|/);
  });
});
