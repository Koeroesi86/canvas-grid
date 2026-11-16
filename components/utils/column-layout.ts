/** Narrowest a column can get when it sets no `minWidth`. */
export const DEFAULT_MIN_COLUMN_WIDTH = 20;

/** Keeps a width within its limits; a `maxWidth` below the minimum loses. */
export const clampWidth = (width: number, minWidth = DEFAULT_MIN_COLUMN_WIDTH, maxWidth = Infinity) =>
  Math.round(Math.max(minWidth, Math.min(maxWidth, width)));

/**
 * Left edge of every column, followed by the total width: `offsets[i]` is where column `i` starts and
 * `offsets[widths.length]` is where the last one ends. Widths are rounded, as they are when drawn.
 */
export const buildOffsets = (widths: readonly number[]) => {
  const offsets = new Array<number>(widths.length + 1);
  offsets[0] = 0;
  widths.forEach((width, index) => {
    offsets[index + 1] = offsets[index] + Math.round(width);
  });
  return offsets;
};

/** Index of the column containing `x`, found by binary search; clamped to the first and last column. */
export const columnAt = (offsets: readonly number[], x: number) => {
  const last = offsets.length - 2;
  if (last < 0) return -1;

  let low = 0;
  let high = last;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (offsets[middle] <= x) low = middle;
    else high = middle - 1;
  }
  return low;
};

/**
 * The column whose right edge is within `tolerance` of `x`, i.e. the one a drag from there would resize,
 * or -1. Where two edges are equally close (zero-width columns do not exist, but touch targets overlap) the left one wins.
 */
export const borderAt = (offsets: readonly number[], x: number, tolerance: number) => {
  const index = columnAt(offsets, x + tolerance);
  if (index < 0) return -1;

  // the border on the right of the column containing the point, or of the previous column when the point is near its left edge
  const rightOfPrevious = index > 0 && Math.abs(offsets[index] - x) <= tolerance ? index - 1 : -1;
  const rightOfCurrent = Math.abs(offsets[index + 1] - x) <= tolerance ? index : -1;
  return rightOfPrevious >= 0 ? rightOfPrevious : rightOfCurrent;
};
