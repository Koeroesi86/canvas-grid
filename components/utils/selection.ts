import type { CellPosition, CellRange, GridSelection, SelectionLevel, SelectionMode, Span } from '../types';

/** Furthest the grid scrolls per frame while a selection is dragged past its edge, in px. */
export const DRAG_SCROLL_MAX = 30;

/** The two indexes as a span, smaller first. */
export const span = (a: number, b: number): Span => (a <= b ? [a, b] : [b, a]);

const makeRange = (rows: Span | undefined, columns: Span | undefined): CellRange => ({
  ...(rows && { rows }),
  ...(columns && { columns }),
});

export const rangeBetween = (from: CellPosition, to: CellPosition): CellRange =>
  makeRange(span(from.row, to.row), span(from.column, to.column));

/** The range a drag from `from` to `to` selects: what it covers depends on the mode, whole rows in `row` mode and so on. */
export const rangeFor = (mode: SelectionMode, from: CellPosition, to: CellPosition): CellRange => {
  if (mode === 'range') return rangeBetween(from, to);
  if (mode === 'row') return makeRange(span(from.row, to.row), undefined);
  if (mode === 'column') return makeRange(undefined, span(from.column, to.column));
  return rangeBetween(to, to);
};

const normalizeSpan = (value: Span): Span => span(Math.max(0, Math.floor(value[0])), Math.max(0, Math.floor(value[1])));

/** A copy with whole-number, ordered, non-negative spans; what `setSelection` stores. */
export const normalizeRange = (range: CellRange): CellRange =>
  makeRange(range.rows && normalizeSpan(range.rows), range.columns && normalizeSpan(range.columns));

const copySpan = (value: Span | undefined): Span | undefined => value && [value[0], value[1]];

const copyRange = (range: CellRange): CellRange => makeRange(copySpan(range.rows), copySpan(range.columns));

/** Rows and columns a range really covers, both inclusive. */
export interface Bounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** The part of the range inside a grid of the given size, or undefined when none of it is. */
export const resolve = (range: CellRange, rowCount: number, columnCount: number): Bounds | undefined => {
  const top = Math.max(0, range.rows?.[0] ?? 0);
  const bottom = Math.min(rowCount - 1, range.rows?.[1] ?? rowCount - 1);
  const left = Math.max(0, range.columns?.[0] ?? 0);
  const right = Math.min(columnCount - 1, range.columns?.[1] ?? columnCount - 1);
  return top > bottom || left > right ? undefined : { top, bottom, left, right };
};

const within = (index: number, value: Span | undefined) => value === undefined || (index >= value[0] && index <= value[1]);

const coversAll = (value: Span | undefined, count: number) => value === undefined || (value[0] <= 0 && value[1] >= count - 1);

export const contains = (range: CellRange, row: number, column: number) => within(row, range.rows) && within(column, range.columns);

/** How much of a column is selected. Row numbers are drawn on every scroll, so this allocates nothing. */
export const columnLevel = (ranges: readonly CellRange[], column: number, rowCount: number): SelectionLevel => {
  let level: SelectionLevel = 'none';
  for (const range of ranges) {
    if (!within(column, range.columns)) continue;
    if (coversAll(range.rows, rowCount)) return 'full';
    level = 'partial';
  }
  return level;
};

/** How much of a row is selected. */
export const rowLevel = (ranges: readonly CellRange[], row: number, columnCount: number): SelectionLevel => {
  let level: SelectionLevel = 'none';
  for (const range of ranges) {
    if (!within(row, range.rows)) continue;
    if (coversAll(range.columns, columnCount)) return 'full';
    level = 'partial';
  }
  return level;
};

/** What a range covers: everything, whole columns, whole rows, or a block of cells. */
export const shapeOf = (range: CellRange): 'all' | 'column' | 'row' | 'block' => {
  if (range.rows === undefined && range.columns === undefined) return 'all';
  if (range.rows === undefined) return 'column';
  if (range.columns === undefined) return 'row';
  return 'block';
};

/** Rows run down the grid and columns across it; a header selects a line of cells along one of them. */
export type Axis = 'row' | 'column';

/** A whole row or column, or a run of them from `from` to `to`. */
export const lineRange = (axis: Axis, from: number, to: number): CellRange =>
  axis === 'column' ? makeRange(undefined, span(from, to)) : makeRange(span(from, to), undefined);

/** The cell at `index` along the axis and `cross` along the other. */
export const linePosition = (axis: Axis, index: number, cross: number): CellPosition =>
  axis === 'column' ? { row: cross, column: index } : { row: index, column: cross };

/** The index of a position along the axis. */
export const lineIndex = (axis: Axis, position: CellPosition) => (axis === 'column' ? position.column : position.row);

/** The index of a position along the other axis. */
export const crossIndex = (axis: Axis, position: CellPosition) => (axis === 'column' ? position.row : position.column);

const sameSpan = (a: Span | undefined, b: Span | undefined) => a?.[0] === b?.[0] && a?.[1] === b?.[1];

const sameRange = (a: CellRange, b: CellRange) => sameSpan(a.rows, b.rows) && sameSpan(a.columns, b.columns);

const samePosition = (a: CellPosition | undefined, b: CellPosition | undefined) => a?.row === b?.row && a?.column === b?.column;

const clampSpan = (value: Span | undefined, count: number): Span | undefined => value && [value[0], Math.min(value[1], count - 1)];

const clampPosition = (position: CellPosition | undefined, rowCount: number, columnCount: number): CellPosition | undefined =>
  position && { row: Math.min(position.row, rowCount - 1), column: Math.min(position.column, columnCount - 1) };

/**
 * The selected ranges, the active cell (where typing and keyboard moves start; it sits inside the last range)
 * and the focus corner (the end of the last range that moves when the selection is extended).
 * Every change returns whether the ranges or the active cell differ afterwards.
 */
class SelectionModel {
  ranges: CellRange[] = [];

  active: CellPosition | undefined = undefined;

  focus: CellPosition | undefined = undefined;

  private assign(ranges: CellRange[], active: CellPosition | undefined, focus: CellPosition | undefined) {
    const changed = ranges.length !== this.ranges.length
      || ranges.some((range, index) => !sameRange(range, this.ranges[index]))
      || !samePosition(active, this.active);
    this.ranges = ranges;
    this.active = active && { row: active.row, column: active.column };
    this.focus = focus && { row: focus.row, column: focus.column };
    return changed;
  }

  /** Makes this the only range, with `active` in focus. */
  set(range: CellRange, active: CellPosition, focus: CellPosition = active) {
    return this.assign([normalizeRange(range)], active, focus);
  }

  /** Adds a range to the selection, as ctrl+click does. */
  add(range: CellRange, active: CellPosition) {
    return this.assign([...this.ranges, normalizeRange(range)], active, active);
  }

  /** Replaces the last range, as shift+click or dragging does; the active cell stays and `focus` becomes the moving corner. */
  extend(range: CellRange, focus: CellPosition) {
    if (this.ranges.length === 0 || this.active === undefined) return this.set(range, focus);
    return this.assign([...this.ranges.slice(0, -1), normalizeRange(range)], this.active, focus);
  }

  clear() {
    return this.assign([], undefined, undefined);
  }

  /** Moves the active cell without touching the ranges, as Enter and Tab do inside a selection. */
  activate(position: CellPosition) {
    return this.assign(this.ranges, position, position);
  }

  /** Replaces everything, with the first cell of the last range active unless `active` says otherwise. */
  replace(ranges: readonly CellRange[], active?: CellPosition) {
    const normalized = ranges.map(normalizeRange);
    const last = normalized[normalized.length - 1];
    if (last === undefined) return this.clear();

    const start = active ?? { row: last.rows?.[0] ?? 0, column: last.columns?.[0] ?? 0 };
    return this.assign(normalized, start, start);
  }

  /** Fits the selection to a grid of the given size, dropping what lies outside it; an empty grid selects nothing. */
  clamp(rowCount: number, columnCount: number) {
    if (rowCount === 0 || columnCount === 0) return this.clear();

    const ranges = this.ranges
      .filter(range => resolve(range, rowCount, columnCount) !== undefined)
      .map(range => makeRange(clampSpan(range.rows, rowCount), clampSpan(range.columns, columnCount)));
    if (ranges.length === 0) return this.clear();

    return this.assign(ranges, clampPosition(this.active, rowCount, columnCount), clampPosition(this.focus, rowCount, columnCount));
  }

  /** A copy that is safe to hand out. */
  snapshot(): GridSelection {
    return { ranges: this.ranges.map(copyRange), active: this.active && { ...this.active } };
  }
}

/** How fast to scroll while dragging with the pointer at `value` and the visible area between `min` and `max`: negative is back, 0 inside. */
export const dragScrollSpeed = (value: number, min: number, max: number) => {
  if (value < min) return -Math.min(DRAG_SCROLL_MAX, Math.max(2, (min - value) / 4));
  if (value > max) return Math.min(DRAG_SCROLL_MAX, Math.max(2, (value - max) / 4));
  return 0;
};

export default SelectionModel;
