import React from '../utils/jsx';
import Renderer from '../utils/renderer';
import { getContext2d } from '../utils/canvas';
import RectangleRenderer from '../rectangle';
import TextRenderer from '../text';
import type { PositionalRenderer } from '../types';

export interface HeaderOptions {
  canvas: HTMLCanvasElement;
  background: string;
  font: string;
  color: string;
  characters: string;
  borderRightWidth: number;
  borderRightColor: string;
  borderBottomWidth: number;
  borderBottomColor: string;
}

class HeaderRenderer extends Renderer<HeaderOptions> implements PositionalRenderer {
  static readonly defaultOptions: Omit<HeaderOptions, 'canvas'> = {
    background: '#333',
    font: '13px monospace',
    color: '#fff',
    characters: '',
    borderRightWidth: 1,
    borderRightColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
  };

  isScrolling = false;

  private readonly rectangleRenderer = new RectangleRenderer();

  private readonly textRenderer: TextRenderer;

  private readonly ctx: CanvasRenderingContext2D;

  private readonly hasBottomBorder: boolean;

  private readonly hasRightBorder: boolean;

  constructor(options: Pick<HeaderOptions, 'canvas'> & Partial<HeaderOptions>) {
    super({ ...HeaderRenderer.defaultOptions, ...options });

    this.textRenderer = new TextRenderer({
      font: this.options.font,
      color: this.options.color,
      characters: this.options.characters,
    });
    this.ctx = getContext2d(this.options.canvas, { alpha: true });

    this.hasBottomBorder = this.options.borderBottomWidth > 0 && !!this.options.borderBottomColor;
    this.hasRightBorder = this.options.borderRightWidth > 0 && !!this.options.borderRightColor;
  }

  set font(font: string) {
    this.textRenderer.font = font;
  }

  get font() {
    return this.textRenderer.font;
  }

  render(value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {
    if (width === 0 || height === 0) return;
    this.rectangleRenderer.color = this.options.background;
    this.ctx.drawImage(<this.rectangleRenderer.element
      key={`headerBackground-${this.rectangleRenderer.color}-${width}-${height}`}
      width={width}
      height={height}
    />, x, y);

    if (this.hasRightBorder) {
      this.rectangleRenderer.color = this.options.borderRightColor;
      this.ctx.drawImage(
        <this.rectangleRenderer.element
          key={`headerBorder-${this.rectangleRenderer.color}-${this.options.borderRightWidth}-${height}`}
          height={height}
          width={this.options.borderRightWidth}
        />,
        x + width - this.options.borderRightWidth,
        y
      );
    }

    if (this.hasBottomBorder) {
      this.rectangleRenderer.color = this.options.borderBottomColor;
      this.ctx.drawImage(
        <this.rectangleRenderer.element
          key={`headerBorder-${this.rectangleRenderer.color}-${width}-${this.options.borderBottomWidth}`}
          width={width}
          height={this.options.borderBottomWidth}
        />,
        x,
        y + height - this.options.borderBottomWidth
      );
    }

    this.textRenderer.color = this.options.color;
    this.ctx.drawImage(<this.textRenderer.element
      key={`headerText-${value}-${this.textRenderer.font}`}
      value={value}
      x={0}
      y={0}
      width={width}
      height={height}
      isUpdated={isUpdated}
      isValueUpdated={isValueUpdated}
      forcedDraw={forcedDraw}
      diff={diff}
    />, x, y);
  }
}

export default HeaderRenderer;
