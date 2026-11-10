import React from '../utils/jsx';
import Renderer from '../utils/renderer';
import TextRenderer from '../text';
import type { TextStyle } from '../text';
import type { CellContext, CellRenderer } from '../types';

export interface CellValueOptions {
  layer: string;
  font: string;
  color: string;
}

export default class CellValueRenderer extends Renderer<CellValueOptions> implements CellRenderer {
  static readonly defaultOptions: CellValueOptions = {
    layer: 'content',
    font: '12px monospace',
    color: '#fff',
  };

  private readonly renderer: TextRenderer;

  constructor(options: Partial<CellValueOptions> = {}) {
    super({ ...CellValueRenderer.defaultOptions, ...options });

    this.renderer = new TextRenderer({
      font: this.options.font,
      color: this.options.color,
    });
  }

  get layer() {
    return this.options.layer;
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

  set pixelRatio(pixelRatio: number) {
    this.renderer.pixelRatio = pixelRatio;
  }

  get pixelRatio() {
    return this.renderer.pixelRatio;
  }

  setTextStyle(style: Partial<TextStyle>) {
    this.renderer.setStyle(style);
  }

  clearCache() {
    this.renderer.clearCache();
  }

  draw({ ctx, x, y, width, height, formatted, valueChanged, forced }: Readonly<CellContext>) {
    if (!valueChanged && !forced) return;

    ctx.clearRect(x, y, width, height);
    (<this.renderer.element value={formatted} width={width} height={height} />).draw(ctx, x, y);
  }
}
