import { primitive } from '../utils/jsx';
import type { SortDirection } from '../types';

export interface SortIndicatorProps {
  /** Width and height of the area the arrow is centred in, relative to the draw origin. */
  width: number;
  height: number;
  direction: SortDirection;
  color: string;
}

/** Width of the arrow's area, for the header to keep its text clear of it. */
export const SORT_INDICATOR_AREA = 18;

const ARROW_WIDTH = 8;
const ARROW_HEIGHT = 5;
const ARROW_ALPHA = 0.75;

/** Small filled triangle at the right end of a header: pointing up for ascending, down for descending. */
const SortIndicator = primitive<SortIndicatorProps>((ctx, { width, height, direction, color }, originX, originY) => {
  // whole pixels, so the edges stay crisp
  const left = Math.round(originX + width - (SORT_INDICATOR_AREA + ARROW_WIDTH) / 2);
  const top = Math.round(originY + (height - ARROW_HEIGHT) / 2);
  const ascending = direction === 'asc';

  ctx.beginPath();
  ctx.moveTo(left, ascending ? top + ARROW_HEIGHT : top);
  ctx.lineTo(left + ARROW_WIDTH, ascending ? top + ARROW_HEIGHT : top);
  ctx.lineTo(left + ARROW_WIDTH / 2, ascending ? top : top + ARROW_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = ARROW_ALPHA;
  ctx.fill();
  ctx.globalAlpha = 1;
});

export default SortIndicator;
