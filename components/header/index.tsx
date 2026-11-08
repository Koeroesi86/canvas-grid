import React, { Group } from '../utils/jsx';
import Renderer from '../utils/renderer';
import { getContext2d } from '../utils/canvas';
import Rect from '../rectangle';
import TextRenderer from '../text';
import type { PositionalRenderer, RenderProps } from '../types';

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

  render({ value = '', x = 0, y = 0, width = 0, height = 0 }: RenderProps) {
    if (width === 0 || height === 0) return;

    const { background, borderRightWidth, borderRightColor, borderBottomWidth, borderBottomColor } = this.options;

    (
      <Group>
        <Rect width={width} height={height} color={background} />
        {this.hasRightBorder && <Rect x={width - borderRightWidth} width={borderRightWidth} height={height} color={borderRightColor} />}
        {this.hasBottomBorder && <Rect y={height - borderBottomWidth} width={width} height={borderBottomWidth} color={borderBottomColor} />}
        <this.textRenderer.element value={value} width={width} height={height} />
      </Group>
    ).draw(this.ctx, x, y);
  }
}

export default HeaderRenderer;
