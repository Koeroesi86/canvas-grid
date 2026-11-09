import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareResults, formatMarkdown, median, type ScrollResult } from './benchmark-comparison.mts';

const result = (overrides: Partial<ScrollResult> = {}): ScrollResult => ({
  fps: 60,
  frameMedianMs: 16,
  frameP95Ms: 20,
  frameMaxMs: 30,
  drawMeanMs: 5,
  drawP95Ms: 8,
  stalledFrames: 0,
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
    assert.ok(find('Draw time p95 (ms)', compareResults([result()], [result({ drawP95Ms: 40 })], 0.3)).regression > 0);
  });

  it('fails only past the threshold', () => {
    assert.equal(find('Draw time mean (ms)', compareResults([result()], [result({ drawMeanMs: 6.5 })], 0.3)).failed, false);
    assert.equal(find('Draw time mean (ms)', compareResults([result()], [result({ drawMeanMs: 6.6 })], 0.3)).failed, true);
  });

  it('does not gate on frame rate or frame times, which saturate and come in whole frames', () => {
    assert.equal(find('Scroll FPS', compareResults([result()], [result({ fps: 20 })], 0.3)).failed, false);
    assert.equal(find('Frame time p95 (ms)', compareResults([result()], [result({ frameP95Ms: 200 })], 0.3)).failed, false);
    assert.equal(find('Frame time max (ms)', compareResults([result()], [result({ frameMaxMs: 300 })], 0.3)).failed, false);
  });

  it('uses the median across runs so one outlier does not decide', () => {
    const head = [result({ drawMeanMs: 5 }), result({ drawMeanMs: 50 }), result({ drawMeanMs: 5.2 })];
    assert.equal(find('Draw time mean (ms)', compareResults([result()], head, 0.3)).failed, false);
  });
});

describe('stalled frames', () => {
  const stalled = (count: number) => [result({ stalledFrames: count })];
  const label = 'Stalled frames (>50 ms)';

  it('tolerates an isolated spike but fails past the allowance, even from a base of zero', () => {
    assert.equal(find(label, compareResults(stalled(0), stalled(2), 0.3, 2)).failed, false);
    assert.equal(find(label, compareResults(stalled(0), stalled(3), 0.3, 2)).failed, true);
  });

  it('compares by difference, so a noisy base does not hide a regression', () => {
    assert.equal(find(label, compareResults(stalled(10), stalled(14), 0.3, 2)).failed, true);
    assert.equal(find(label, compareResults(stalled(10), stalled(6), 0.3, 2)).failed, false);
  });

  it('uses the median across runs', () => {
    const head = [result({ stalledFrames: 0 }), result({ stalledFrames: 40 }), result({ stalledFrames: 1 })];
    assert.equal(find(label, compareResults([result()], head, 0.3, 2)).failed, false);
  });

  it('reports the difference rather than a percentage', () => {
    const markdown = formatMarkdown(compareResults(stalled(0), stalled(5), 0.3, 2), 0.3, 1, 2);
    assert.match(markdown, /\| Stalled frames \(>50 ms\) \| 0\.00 \| 5\.00 \| \+5 \| regression \|/);
  });
});

describe('formatMarkdown', () => {
  it('renders a row per metric and flags regressions', () => {
    const markdown = formatMarkdown(compareResults([result()], [result({ drawMeanMs: 10 })], 0.3), 0.3, 1);
    assert.match(markdown, /\| Draw time mean \(ms\) \| 5\.00 \| 10\.00 \| \+100\.0% \| regression \|/);
  });

  it('states the renderer, and warns when it is software rasterisation', () => {
    const comparisons = compareResults([result()], [result()], 0.3);
    assert.match(formatMarkdown(comparisons, 0.3, 1, 2, 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)'), /Renderer: ANGLE .*software rasterisation/);
    const gpu = formatMarkdown(comparisons, 0.3, 1, 2, 'ANGLE (AMD, AMD Radeon 780M Graphics, OpenGL ES 3.2)');
    assert.match(gpu, /Renderer: ANGLE \(AMD/);
    assert.doesNotMatch(gpu, /software/);
    assert.doesNotMatch(formatMarkdown(comparisons, 0.3, 1), /Renderer/);
  });
});
