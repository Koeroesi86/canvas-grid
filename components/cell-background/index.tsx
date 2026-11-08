import React, { Group } from '../utils/jsx';
import Renderer from '../utils/renderer';
import { getContext2d } from '../utils/canvas';
import Rect from '../rectangle';
import type { PositionalRenderer, RenderProps } from '../types';

export interface CellBackgroundOptions {
  canvas: HTMLCanvasElement;
  enableFlashing: boolean;
  background: string;
  alpha: boolean;
  flashInDuration: number;
  flashOutDuration: number;
  flashRGB: string;
  borderRightWidth: number;
  borderRightColor: string;
  borderBottomWidth: number;
  borderBottomColor: string;
}

class CellBackground extends Renderer<CellBackgroundOptions> implements PositionalRenderer {
  static readonly defaultOptions: Omit<CellBackgroundOptions, 'canvas'> = {
    enableFlashing: true,
    background: '#333',
    alpha: true,
    flashInDuration: 200,
    flashOutDuration: 400,
    flashRGB: '214, 144, 13',
    borderRightWidth: 0,
    borderRightColor: '#fff',
    borderBottomWidth: 0,
    borderBottomColor: '#fff',
  };

  isScrolling = false;

  private readonly ctx: CanvasRenderingContext2D;

  private readonly hasBottomBorder: boolean;

  private readonly hasRightBorder: boolean;

  constructor(options: Pick<CellBackgroundOptions, 'canvas'> & Partial<CellBackgroundOptions>) {
    super({ ...CellBackground.defaultOptions, ...options });

    this.ctx = getContext2d(this.options.canvas, { alpha: this.options.alpha });

    this.hasBottomBorder = this.options.borderBottomWidth > 0 && !!this.options.borderBottomColor;
    this.hasRightBorder = this.options.borderRightWidth > 0 && !!this.options.borderRightColor;
  }

  /** Flash opacity for a cell updated `diff` ms ago: fades in, then out, then 0. */
  private getFlashAlpha(diff: number) {
    if (!this.options.enableFlashing || this.isScrolling) return 0;

    const { flashInDuration, flashOutDuration } = this.options;
    const alpha = diff < flashInDuration
      ? diff / flashInDuration
      : (flashInDuration + flashOutDuration - diff) / flashOutDuration;
    return Math.max(0, Math.round(alpha * 1000) / 1000);
  }

  render({ x = 0, y = 0, width = 0, height = 0, diff = 0 }: RenderProps) {
    const { background, flashRGB, borderRightWidth, borderRightColor, borderBottomWidth, borderBottomColor } = this.options;
    const flash = this.getFlashAlpha(diff);

    (
      <Group>
        <Rect width={width} height={height} color={background} />
        {flash > 0 && <Rect width={width} height={height} color={`rgb(${flashRGB})`} alpha={flash} />}
        {this.hasRightBorder && <Rect x={width - borderRightWidth} width={borderRightWidth} height={height} color={borderRightColor} />}
        {this.hasBottomBorder && <Rect y={height - borderBottomWidth} width={width} height={borderBottomWidth} color={borderBottomColor} />}
      </Group>
    ).draw(this.ctx, x, y);
  }
}

export default CellBackground;
