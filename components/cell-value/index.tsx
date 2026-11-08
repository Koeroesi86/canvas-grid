import React from '../utils/jsx';
import Renderer from '../utils/renderer';
import { getContext2d } from '../utils/canvas';
import TextRenderer from '../text';
import type { PositionalRenderer } from '../types';

export interface CellValueOptions {
  canvas: HTMLCanvasElement;
  alpha: boolean;
  font: string;
  color: string;
  characters: string;
}

export default class CellValueRenderer extends Renderer<CellValueOptions> implements PositionalRenderer {
  static readonly defaultOptions: Omit<CellValueOptions, 'canvas'> = {
    alpha: true,
    font: '12px monospace',
    color: '#fff',
    characters: '',
  };

  isScrolling = false;

  private readonly renderer: TextRenderer;

  private readonly ctx: CanvasRenderingContext2D;

  constructor(options: Pick<CellValueOptions, 'canvas'> & Partial<CellValueOptions>) {
    super({ ...CellValueRenderer.defaultOptions, ...options });

    this.renderer = new TextRenderer({
      font: this.options.font,
      color: this.options.color,
      characters: this.options.characters,
    });

    this.ctx = getContext2d(this.options.canvas, { alpha: this.options.alpha });
  }

  set font(font: string) {
    this.options.font = font;
    this.renderer.font = font;
  }

  get font() {
    return this.options.font;
  }

  set color(color: string) {
    this.options.color = color;
    this.renderer.color = color;
  }

  get color() {
    return this.options.color;
  }

  clearCache() {
    this.renderer.clearCache();
    React.invalidateCache((_, key) => /^cellValue-/.test(`${key}`));
  }

  preWarmCache() {
    this.renderer.preWarmCache();
  }

  render(value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {
    if (isValueUpdated || forcedDraw) {
      this.ctx.clearRect(x, y, width, height);
      this.ctx.drawImage(<this.renderer.element
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
}
