import { primitive } from '../utils/jsx';

export interface RectProps {
  x?: number;
  y?: number;
  width: number;
  height: number;
  color: string;
  /** Opacity from 0 to 1, applied on top of the color. */
  alpha?: number;
}

/** Solid rectangle, filled straight onto the target context. */
const Rect = primitive<RectProps>((ctx, { x = 0, y = 0, width, height, color, alpha = 1 }, originX, originY) => {
  const w = Math.trunc(width);
  const h = Math.trunc(height);
  if (!color || w <= 0 || h <= 0 || alpha <= 0) return;

  ctx.fillStyle = color;
  if (alpha >= 1) {
    ctx.fillRect(originX + x, originY + y, w, h);
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.fillRect(originX + x, originY + y, w, h);
  ctx.globalAlpha = 1;
});

export default Rect;
