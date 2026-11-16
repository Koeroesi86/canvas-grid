import { crossIndex, lineIndex, linePosition } from './selection';
import type { Axis, Bounds } from './selection';
import type { CellPosition } from '../types';

/** The size of the grid the keyboard moves in; `pageRows` is how many rows PageUp and PageDown skip. */
export interface GridSize {
  rowCount: number;
  columnCount: number;
  pageRows: number;
}

const clamp = (value: number, last: number) => Math.max(0, Math.min(last, value));

/**
 * Where a navigation key takes the cursor from `from`, or undefined for any other key. Arrows move one cell and, with ctrl, to the edge;
 * Home and End go to the first and last column (with ctrl also the first and last row); PageUp and PageDown move a page of rows.
 * The result is always inside the grid.
 */
export const moveTarget = (from: CellPosition, key: string, ctrl: boolean, { rowCount, columnCount, pageRows }: GridSize): CellPosition | undefined => {
  const lastRow = rowCount - 1;
  const lastColumn = columnCount - 1;
  const at = (row: number, column: number): CellPosition => ({ row: clamp(row, lastRow), column: clamp(column, lastColumn) });
  switch (key) {
    case 'ArrowUp': return at(ctrl ? 0 : from.row - 1, from.column);
    case 'ArrowDown': return at(ctrl ? lastRow : from.row + 1, from.column);
    case 'ArrowLeft': return at(from.row, ctrl ? 0 : from.column - 1);
    case 'ArrowRight': return at(from.row, ctrl ? lastColumn : from.column + 1);
    case 'Home': return at(ctrl ? 0 : from.row, 0);
    case 'End': return at(ctrl ? lastRow : from.row, lastColumn);
    case 'PageUp': return at(from.row - pageRows, from.column);
    case 'PageDown': return at(from.row + pageRows, from.column);
    default: return undefined;
  }
};

/**
 * The next cell inside `bounds` for Enter (`axis` `'row'`, going down) or Tab (`'column'`, going right), one back with `backwards`.
 * Past the end of a line it continues on the next one, and past the last cell it starts over.
 */
export const stepWithin = (bounds: Bounds, from: CellPosition, axis: Axis, backwards: boolean): CellPosition => {
  const direction = backwards ? -1 : 1;
  const [alongFirst, alongLast, crossFirst, crossLast] = axis === 'row'
    ? [bounds.top, bounds.bottom, bounds.left, bounds.right]
    : [bounds.left, bounds.right, bounds.top, bounds.bottom];
  const along = lineIndex(axis, from) + direction;
  if (along >= alongFirst && along <= alongLast) return linePosition(axis, along, crossIndex(axis, from));

  const crossCount = crossLast - crossFirst + 1;
  const wrapped = crossFirst + ((crossIndex(axis, from) + direction - crossFirst) % crossCount + crossCount) % crossCount;
  return linePosition(axis, direction > 0 ? alongFirst : alongLast, wrapped);
};

/**
 * The scroll offset that brings the span `start` to `end` into view in a viewport of `size`, starting from `scroll`:
 * unchanged when it is already visible, and the span's start wins when it is larger than the viewport.
 */
export const revealOffset = (start: number, end: number, scroll: number, size: number) => Math.min(start, Math.max(scroll, end - size));
