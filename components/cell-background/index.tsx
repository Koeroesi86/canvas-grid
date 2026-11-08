import React from '../utils/jsx';
import Renderer from '../utils/renderer';
import { getContext2d } from '../utils/canvas';
import RectangleRenderer from '../rectangle';
import type { PositionalRenderer } from '../types';

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

  private readonly rectangleRenderer: RectangleRenderer;

  private readonly ctx: CanvasRenderingContext2D;

  private readonly hasBottomBorder: boolean;

  private readonly hasRightBorder: boolean;

  constructor(options: Pick<CellBackgroundOptions, 'canvas'> & Partial<CellBackgroundOptions>) {
    super({ ...CellBackground.defaultOptions, ...options });

    this.rectangleRenderer = new RectangleRenderer({
      alpha: this.options.alpha,
    });
    this.ctx = getContext2d(this.options.canvas, { alpha: this.options.alpha });

    this.hasBottomBorder = this.options.borderBottomWidth > 0 && !!this.options.borderBottomColor;
    this.hasRightBorder = this.options.borderRightWidth > 0 && !!this.options.borderRightColor;
  }

  render(_value = '', x = 0, y = 0, width = 0, height = 0, _isUpdated = false, _isValueUpdated = false, _forcedDraw = false, diff = 0) {
    this.rectangleRenderer.color = this.options.background;
    this.ctx.drawImage(<this.rectangleRenderer.element
      key={`cellBackground-${this.rectangleRenderer.color}-${width}-${height}`}
      width={width}
      height={height}
    />, x, y);

    if (this.options.enableFlashing && !this.isScrolling) {
      let alpha = 0;
      const totalFlashDuration = this.options.flashInDuration + this.options.flashOutDuration;
      if (diff <= totalFlashDuration) {
        if (diff < this.options.flashInDuration) {
          alpha = (diff / this.options.flashInDuration);
        } else if (diff > this.options.flashInDuration && diff <= totalFlashDuration) {
          alpha = ((totalFlashDuration - diff) / this.options.flashOutDuration);
        }

        if (alpha > 0) {
          this.rectangleRenderer.color = `rgba(${this.options.flashRGB}, ${alpha.toFixed(3)})`;
          this.ctx.drawImage(<this.rectangleRenderer.element
            key={`cellBackground-${this.rectangleRenderer.color}-${width}-${height}`}
            width={width}
            height={height}
          />, x, y);
        }
      }
    }

    if (this.hasRightBorder) {
      this.rectangleRenderer.color = this.options.borderRightColor;
      this.ctx.drawImage(<this.rectangleRenderer.element
        key={`cellBorder-${this.rectangleRenderer.color}-${this.options.borderRightWidth}-${height}`}
        width={this.options.borderRightWidth}
        height={height}
      />, x + width - this.options.borderRightWidth, y);
    }

    if (this.hasBottomBorder) {
      this.rectangleRenderer.color = this.options.borderBottomColor;
      this.ctx.drawImage(<this.rectangleRenderer.element
        key={`cellBorder-${this.rectangleRenderer.color}-${width}-${this.options.borderBottomWidth}`}
        width={width}
        height={this.options.borderBottomWidth}
      />, x, y + height - this.options.borderBottomWidth);
    }
  }
}

export default CellBackground;
