import React from '../utils/jsx';
import Renderer from '../utils/renderer';
import { getContext2d } from '../utils/canvas';
import TextRenderer from '../text';
import type { PositionalRenderer, RenderProps } from '../types';

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
  }

  render({ value = '', x = 0, y = 0, width = 0, height = 0, isValueUpdated = false, forcedDraw = false }: RenderProps) {
    if (!isValueUpdated && !forcedDraw) return;

    this.ctx.clearRect(x, y, width, height);
    (<this.renderer.element value={value} width={width} height={height} />).draw(this.ctx, x, y);
  }
}
