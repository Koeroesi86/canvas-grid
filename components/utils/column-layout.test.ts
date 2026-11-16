import { describe, expect, it } from 'vitest';
import { borderAt, buildOffsets, clampWidth, columnAt, DEFAULT_MIN_COLUMN_WIDTH } from './column-layout';

describe('column layout', () => {
  const offsets = buildOffsets([100, 50, 80]);

  it('accumulates rounded widths, ending with the total', () => {
    expect(offsets).toEqual([0, 100, 150, 230]);
    expect(buildOffsets([10.4, 10.6])).toEqual([0, 10, 21]);
    expect(buildOffsets([])).toEqual([0]);
  });

  it('finds the column containing an offset, clamped to the ends', () => {
    expect(columnAt(offsets, 0)).toBe(0);
    expect(columnAt(offsets, 99)).toBe(0);
    expect(columnAt(offsets, 100)).toBe(1);
    expect(columnAt(offsets, 229)).toBe(2);
    expect(columnAt(offsets, -5)).toBe(0);
    expect(columnAt(offsets, 1000)).toBe(2);
    expect(columnAt(buildOffsets([]), 5)).toBe(-1);
  });

  it('finds the border within reach, belonging to the column on its left', () => {
    expect(borderAt(offsets, 98, 4)).toBe(0);
    expect(borderAt(offsets, 102, 4)).toBe(0);
    expect(borderAt(offsets, 150, 4)).toBe(1);
    expect(borderAt(offsets, 232, 4)).toBe(2);
    expect(borderAt(offsets, 50, 4)).toBe(-1);
    expect(borderAt(offsets, 0, 4)).toBe(-1);
    expect(borderAt(buildOffsets([]), 0, 4)).toBe(-1);
  });

  it('clamps to the limits, and the default minimum', () => {
    expect(clampWidth(5)).toBe(DEFAULT_MIN_COLUMN_WIDTH);
    expect(clampWidth(500, 50, 200)).toBe(200);
    expect(clampWidth(30, 50, 200)).toBe(50);
    expect(clampWidth(80.4, 50, 200)).toBe(80);
    expect(clampWidth(300, 50, 20)).toBe(50);
  });
});
