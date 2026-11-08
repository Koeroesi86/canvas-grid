import React, { Group } from '../utils/jsx';
import Renderer from '../utils/renderer';
import Rect from '../rectangle';
import TextRenderer from '../text';
import type { CellContext, CellRenderer } from '../types';

export interface HeaderOptions {
  layer: string;
  background: string;
  font: string;
  color: string;
  borderRightWidth: number;
  borderRightColor: string;
  borderBottomWidth: number;
  borderBottomColor: string;
}

class HeaderRenderer extends Renderer<HeaderOptions> implements CellRenderer {
  static readonly defaultOptions: HeaderOptions = {
    layer: 'header',
    background: '#333',
    font: '13px monospace',
    color: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#fff',
  };

  private readonly textRenderer: TextRenderer;

  constructor(options: Partial<HeaderOptions> = {}) {
    super({ ...HeaderRenderer.defaultOptions, ...options });

    this.textRenderer = new TextRenderer({
      font: this.options.font,
      color: this.options.color,
    });
  }

  get layer() {
    return this.options.layer;
  }

  set font(font: string) {
    this.options.font = font;
    this.textRenderer.font = font;
  }

  get font() {
    return this.textRenderer.font;
  }

  clearCache() {
    this.textRenderer.clearCache();
  }

  draw({ ctx, x, y, width, height, formatted }: Readonly<CellContext>) {
    if (width === 0 || height === 0) return;

    const { background, borderRightWidth, borderRightColor, borderBottomWidth, borderBottomColor } = this.options;

    (
      <Group>
        <Rect width={width} height={height} color={background} />
        {borderRightWidth > 0 && <Rect x={width - borderRightWidth} width={borderRightWidth} height={height} color={borderRightColor} />}
        {borderBottomWidth > 0 && <Rect y={height - borderBottomWidth} width={width} height={borderBottomWidth} color={borderBottomColor} />}
        <this.textRenderer.element value={formatted} width={width} height={height} />
      </Group>
    ).draw(ctx, x, y);
  }
}

export default HeaderRenderer;
