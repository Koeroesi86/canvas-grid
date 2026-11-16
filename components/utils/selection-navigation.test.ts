import { describe, expect, it } from 'vitest';
import { moveTarget, revealOffset, stepAfterEdit, stepWithin } from './selection-navigation';

const size = { rowCount: 100, columnCount: 5, pageRows: 20 };

describe('moveTarget', () => {
  const from = { row: 50, column: 2 };

  it('moves one cell with the arrows', () => {
    expect(moveTarget(from, 'ArrowUp', false, size)).toEqual({ row: 49, column: 2 });
    expect(moveTarget(from, 'ArrowDown', false, size)).toEqual({ row: 51, column: 2 });
    expect(moveTarget(from, 'ArrowLeft', false, size)).toEqual({ row: 50, column: 1 });
    expect(moveTarget(from, 'ArrowRight', false, size)).toEqual({ row: 50, column: 3 });
  });

  it('jumps to the edge with ctrl', () => {
    expect(moveTarget(from, 'ArrowUp', true, size)).toEqual({ row: 0, column: 2 });
    expect(moveTarget(from, 'ArrowDown', true, size)).toEqual({ row: 99, column: 2 });
    expect(moveTarget(from, 'ArrowLeft', true, size)).toEqual({ row: 50, column: 0 });
    expect(moveTarget(from, 'ArrowRight', true, size)).toEqual({ row: 50, column: 4 });
  });

  it('stays inside the grid', () => {
    expect(moveTarget({ row: 0, column: 0 }, 'ArrowUp', false, size)).toEqual({ row: 0, column: 0 });
    expect(moveTarget({ row: 0, column: 0 }, 'ArrowLeft', false, size)).toEqual({ row: 0, column: 0 });
    expect(moveTarget({ row: 99, column: 4 }, 'ArrowDown', false, size)).toEqual({ row: 99, column: 4 });
    expect(moveTarget({ row: 99, column: 4 }, 'ArrowRight', false, size)).toEqual({ row: 99, column: 4 });
  });

  it('goes to the ends of the row with Home and End, and of the grid with ctrl', () => {
    expect(moveTarget(from, 'Home', false, size)).toEqual({ row: 50, column: 0 });
    expect(moveTarget(from, 'End', false, size)).toEqual({ row: 50, column: 4 });
    expect(moveTarget(from, 'Home', true, size)).toEqual({ row: 0, column: 0 });
    expect(moveTarget(from, 'End', true, size)).toEqual({ row: 99, column: 4 });
  });

  it('moves a page of rows, stopping at the ends', () => {
    expect(moveTarget(from, 'PageDown', false, size)).toEqual({ row: 70, column: 2 });
    expect(moveTarget(from, 'PageUp', false, size)).toEqual({ row: 30, column: 2 });
    expect(moveTarget({ row: 95, column: 2 }, 'PageDown', false, size)).toEqual({ row: 99, column: 2 });
    expect(moveTarget({ row: 5, column: 2 }, 'PageUp', false, size)).toEqual({ row: 0, column: 2 });
  });

  it('ignores other keys', () => {
    expect(moveTarget(from, 'a', false, size)).toBeUndefined();
    expect(moveTarget(from, 'Enter', false, size)).toBeUndefined();
  });

  it('pulls a position outside the grid back in', () => {
    expect(moveTarget({ row: 500, column: 9 }, 'ArrowLeft', false, size)).toEqual({ row: 99, column: 4 });
  });
});

describe('stepWithin', () => {
  const bounds = { top: 2, bottom: 4, left: 1, right: 2 };

  it('goes down inside the range with Enter and back up with shift', () => {
    expect(stepWithin(bounds, { row: 2, column: 1 }, 'row', false)).toEqual({ row: 3, column: 1 });
    expect(stepWithin(bounds, { row: 3, column: 1 }, 'row', true)).toEqual({ row: 2, column: 1 });
  });

  it('continues at the top of the next column past the bottom, and starts over after the last cell', () => {
    expect(stepWithin(bounds, { row: 4, column: 1 }, 'row', false)).toEqual({ row: 2, column: 2 });
    expect(stepWithin(bounds, { row: 4, column: 2 }, 'row', false)).toEqual({ row: 2, column: 1 });
  });

  it('goes backwards past the top to the bottom of the previous column, wrapping before the first cell', () => {
    expect(stepWithin(bounds, { row: 2, column: 2 }, 'row', true)).toEqual({ row: 4, column: 1 });
    expect(stepWithin(bounds, { row: 2, column: 1 }, 'row', true)).toEqual({ row: 4, column: 2 });
  });

  it('goes across with Tab, continuing on the next row', () => {
    expect(stepWithin(bounds, { row: 2, column: 1 }, 'column', false)).toEqual({ row: 2, column: 2 });
    expect(stepWithin(bounds, { row: 2, column: 2 }, 'column', false)).toEqual({ row: 3, column: 1 });
    expect(stepWithin(bounds, { row: 4, column: 2 }, 'column', false)).toEqual({ row: 2, column: 1 });
    expect(stepWithin(bounds, { row: 3, column: 1 }, 'column', true)).toEqual({ row: 2, column: 2 });
  });
});

describe('revealOffset', () => {
  it('leaves a visible span alone', () => {
    expect(revealOffset(120, 140, 100, 100)).toBe(100);
  });

  it('scrolls up to a span above the viewport', () => {
    expect(revealOffset(40, 60, 100, 100)).toBe(40);
  });

  it('scrolls down just enough to show a span below the viewport', () => {
    expect(revealOffset(300, 320, 100, 100)).toBe(220);
  });

  it('shows the start of a span that is larger than the viewport', () => {
    expect(revealOffset(300, 500, 0, 100)).toBe(300);
  });
});

describe('stepAfterEdit', () => {
  const grid = { rowCount: 3, columnCount: 2, pageRows: 1 };

  it('moves down on Enter and up with shift, staying at the edge', () => {
    expect(stepAfterEdit({ row: 0, column: 1 }, 'row', false, grid)).toEqual({ row: 1, column: 1 });
    expect(stepAfterEdit({ row: 1, column: 1 }, 'row', true, grid)).toEqual({ row: 0, column: 1 });
    expect(stepAfterEdit({ row: 2, column: 1 }, 'row', false, grid)).toEqual({ row: 2, column: 1 });
    expect(stepAfterEdit({ row: 0, column: 1 }, 'row', true, grid)).toEqual({ row: 0, column: 1 });
  });

  it('moves right on Tab and wraps to the next row, and back with shift', () => {
    expect(stepAfterEdit({ row: 0, column: 0 }, 'column', false, grid)).toEqual({ row: 0, column: 1 });
    expect(stepAfterEdit({ row: 0, column: 1 }, 'column', false, grid)).toEqual({ row: 1, column: 0 });
    expect(stepAfterEdit({ row: 1, column: 0 }, 'column', true, grid)).toEqual({ row: 0, column: 1 });
  });

  it('stays on the last cell of the grid', () => {
    expect(stepAfterEdit({ row: 2, column: 1 }, 'column', false, grid)).toEqual({ row: 2, column: 1 });
    expect(stepAfterEdit({ row: 0, column: 0 }, 'column', true, grid)).toEqual({ row: 0, column: 0 });
  });
});
