import { describe, expect, it } from 'vitest';
import SelectionModel, {
  columnLevel,
  contains,
  crossIndex,
  DRAG_SCROLL_MAX,
  dragScrollSpeed,
  lineIndex,
  linePosition,
  lineRange,
  normalizeRange,
  rangeBetween,
  rangeFor,
  resolve,
  rowLevel,
  span,
} from './selection';

describe('range maths', () => {
  it('orders spans and the corners of a range', () => {
    expect(span(5, 2)).toEqual([2, 5]);
    expect(rangeBetween({ row: 4, column: 1 }, { row: 2, column: 3 })).toEqual({ rows: [2, 4], columns: [1, 3] });
  });

  it('covers what the mode selects', () => {
    const from = { row: 4, column: 1 };
    const to = { row: 2, column: 3 };
    expect(rangeFor('range', from, to)).toEqual({ rows: [2, 4], columns: [1, 3] });
    expect(rangeFor('row', from, to)).toEqual({ rows: [2, 4] });
    expect(rangeFor('column', from, to)).toEqual({ columns: [1, 3] });
    expect(rangeFor('cell', from, to)).toEqual({ rows: [2, 2], columns: [3, 3] });
  });

  it('rounds, orders and floors spans at zero', () => {
    expect(normalizeRange({ rows: [4.7, -2], columns: [3, 1] })).toEqual({ rows: [0, 4], columns: [1, 3] });
    expect(normalizeRange({})).toEqual({});
  });

  it('resolves open ends against the size of the grid', () => {
    expect(resolve({}, 10, 4)).toEqual({ top: 0, bottom: 9, left: 0, right: 3 });
    expect(resolve({ columns: [2, 2] }, 10, 4)).toEqual({ top: 0, bottom: 9, left: 2, right: 2 });
    expect(resolve({ rows: [8, 20], columns: [1, 9] }, 10, 4)).toEqual({ top: 8, bottom: 9, left: 1, right: 3 });
  });

  it('resolves to nothing when the range lies outside the grid', () => {
    expect(resolve({ rows: [10, 12] }, 10, 4)).toBeUndefined();
    expect(resolve({ columns: [4, 4] }, 10, 4)).toBeUndefined();
    expect(resolve({}, 0, 4)).toBeUndefined();
  });

  it('tests whether a cell is inside', () => {
    const range = { rows: [2, 4], columns: [1, 1] } as const;
    expect(contains(range, 3, 1)).toBe(true);
    expect(contains(range, 5, 1)).toBe(false);
    expect(contains(range, 3, 2)).toBe(false);
    expect(contains({ columns: [1, 1] }, 999, 1)).toBe(true);
  });
});

describe('header levels', () => {
  it('reports a column as full when a range covers all its rows', () => {
    expect(columnLevel([{ columns: [2, 3] }], 2, 100)).toBe('full');
    expect(columnLevel([{ rows: [0, 99], columns: [2, 2] }], 2, 100)).toBe('full');
    expect(columnLevel([{}], 7, 100)).toBe('full');
  });

  it('reports a column as partial when only some of its rows are selected', () => {
    expect(columnLevel([{ rows: [3, 5], columns: [2, 2] }], 2, 100)).toBe('partial');
    expect(columnLevel([{ rows: [3, 5], columns: [2, 2] }, { columns: [2, 2] }], 2, 100)).toBe('full');
  });

  it('reports none for columns and rows outside the ranges', () => {
    expect(columnLevel([{ columns: [2, 3] }], 4, 100)).toBe('none');
    expect(columnLevel([], 0, 100)).toBe('none');
    expect(rowLevel([{ rows: [5, 6] }], 7, 4)).toBe('none');
  });

  it('reports rows the same way', () => {
    expect(rowLevel([{ rows: [5, 6] }], 5, 4)).toBe('full');
    expect(rowLevel([{ rows: [5, 6], columns: [0, 1] }], 5, 4)).toBe('partial');
    expect(rowLevel([{ rows: [5, 6], columns: [0, 3] }], 6, 4)).toBe('full');
  });
});

describe('lines', () => {
  it('builds a whole column or row, or a run of them', () => {
    expect(lineRange('column', 5, 2)).toEqual({ columns: [2, 5] });
    expect(lineRange('row', 3, 3)).toEqual({ rows: [3, 3] });
  });

  it('places a position along an axis and across it', () => {
    expect(linePosition('column', 4, 9)).toEqual({ row: 9, column: 4 });
    expect(linePosition('row', 4, 9)).toEqual({ row: 4, column: 9 });
  });

  it('reads a position along an axis and across it', () => {
    const position = { row: 7, column: 2 };
    expect(lineIndex('column', position)).toBe(2);
    expect(lineIndex('row', position)).toBe(7);
    expect(crossIndex('column', position)).toBe(7);
    expect(crossIndex('row', position)).toBe(2);
  });
});

describe('SelectionModel', () => {
  it('selects one range and reports changes only when something differs', () => {
    const model = new SelectionModel();
    expect(model.set({ rows: [1, 1], columns: [2, 2] }, { row: 1, column: 2 })).toBe(true);
    expect(model.set({ rows: [1, 1], columns: [2, 2] }, { row: 1, column: 2 })).toBe(false);
    expect(model.set({ rows: [1, 1], columns: [2, 2] }, { row: 1, column: 3 })).toBe(true);
  });

  it('adds ranges and moves the active cell to the new one', () => {
    const model = new SelectionModel();
    model.set({ rows: [0, 0], columns: [0, 0] }, { row: 0, column: 0 });
    expect(model.add({ rows: [4, 5], columns: [1, 1] }, { row: 4, column: 1 })).toBe(true);
    expect(model.ranges).toEqual([{ rows: [0, 0], columns: [0, 0] }, { rows: [4, 5], columns: [1, 1] }]);
    expect(model.active).toEqual({ row: 4, column: 1 });
  });

  it('extends the last range and keeps the active cell', () => {
    const model = new SelectionModel();
    model.set({ rows: [2, 2], columns: [2, 2] }, { row: 2, column: 2 });
    model.add({ rows: [7, 7], columns: [0, 0] }, { row: 7, column: 0 });
    expect(model.extend({ rows: [5, 7], columns: [0, 3] }, { row: 5, column: 3 })).toBe(true);
    expect(model.ranges).toEqual([{ rows: [2, 2], columns: [2, 2] }, { rows: [5, 7], columns: [0, 3] }]);
    expect(model.active).toEqual({ row: 7, column: 0 });
    expect(model.focus).toEqual({ row: 5, column: 3 });
  });

  it('starts a selection when extending from nothing', () => {
    const model = new SelectionModel();
    model.extend({ rows: [1, 1], columns: [1, 1] }, { row: 1, column: 1 });
    expect(model.ranges).toHaveLength(1);
    expect(model.active).toEqual({ row: 1, column: 1 });
  });

  it('replaces everything, starting at the first cell of the last range', () => {
    const model = new SelectionModel();
    expect(model.replace([{ rows: [3, 4], columns: [1, 2] }, { columns: [5, 6] }])).toBe(true);
    expect(model.active).toEqual({ row: 0, column: 5 });
    expect(model.replace([{ rows: [3, 4] }], { row: 4, column: 2 })).toBe(true);
    expect(model.active).toEqual({ row: 4, column: 2 });
    expect(model.replace([])).toBe(true);
    expect(model.ranges).toEqual([]);
    expect(model.active).toBeUndefined();
  });

  it('clears', () => {
    const model = new SelectionModel();
    expect(model.clear()).toBe(false);
    model.set({}, { row: 0, column: 0 });
    expect(model.clear()).toBe(true);
    expect(model.ranges).toEqual([]);
  });

  it('fits the selection to a smaller grid and keeps open ends open', () => {
    const model = new SelectionModel();
    model.replace([{ rows: [2, 50], columns: [1, 9] }, { columns: [2, 2] }, { rows: [40, 45] }], { row: 2, column: 1 });
    expect(model.clamp(10, 4)).toBe(true);
    expect(model.ranges).toEqual([{ rows: [2, 9], columns: [1, 3] }, { columns: [2, 2] }]);
    expect(model.active).toEqual({ row: 2, column: 1 });
  });

  it('pulls the active cell back inside and leaves a fitting selection alone', () => {
    const model = new SelectionModel();
    model.replace([{ rows: [0, 9] }], { row: 9, column: 0 });
    expect(model.clamp(100, 4)).toBe(false);
    expect(model.clamp(5, 4)).toBe(true);
    expect(model.active).toEqual({ row: 4, column: 0 });
  });

  it('selects nothing in an empty grid', () => {
    const model = new SelectionModel();
    model.set({}, { row: 0, column: 0 });
    expect(model.clamp(0, 4)).toBe(true);
    expect(model.ranges).toEqual([]);
  });

  it('hands out copies', () => {
    const model = new SelectionModel();
    model.set({ rows: [1, 2] }, { row: 1, column: 0 });
    const snapshot = model.snapshot();
    snapshot.ranges.push({});
    expect(model.ranges).toHaveLength(1);
    expect(snapshot.active).not.toBe(model.active);
  });
});

describe('drag scrolling', () => {
  it('does not scroll inside the visible area', () => {
    expect(dragScrollSpeed(50, 0, 100)).toBe(0);
  });

  it('scrolls back or forward faster the further the pointer is outside, up to a limit', () => {
    expect(dragScrollSpeed(-1, 0, 100)).toBe(-2);
    expect(dragScrollSpeed(-40, 0, 100)).toBe(-10);
    expect(dragScrollSpeed(102, 0, 100)).toBe(2);
    expect(dragScrollSpeed(10_000, 0, 100)).toBe(DRAG_SCROLL_MAX);
    expect(dragScrollSpeed(-10_000, 0, 100)).toBe(-DRAG_SCROLL_MAX);
  });
});
