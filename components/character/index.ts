import Collection from '../utils/collection';
import { CanvasRenderer } from '../utils/renderer';
import { getContext2d } from '../utils/canvas';
import type { RenderProps } from '../types';

export interface CharacterOptions {
  font: string;
  color: string;
  alpha: boolean;
  clearBeforeRender: boolean;
}

export default class CharacterRenderer extends CanvasRenderer<CharacterOptions> {
  static readonly defaultOptions: CharacterOptions = {
    font: '12px monospace',
    color: '#fff',
    alpha: true,
    clearBeforeRender: true,
  };

  private readonly charWidthCache = new Collection<number>();

  private readonly canvas = document.createElement('canvas');

  private readonly ctx: CanvasRenderingContext2D;

  constructor(options: Partial<CharacterOptions> = {}) {
    super({ ...CharacterRenderer.defaultOptions, ...options });

    this.ctx = getContext2d(this.canvas, { alpha: this.options.alpha });
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
  }

  set font(font: string) {
    if (this.options.font !== font) {
      this.options.font = font;
    }
  }

  set color(color: string) {
    this.options.color = color;
  }

  clearCache() {
    super.clearCache();
    this.charWidthCache.clear();
  }

  protected cacheKey({ value = '', height = 0 }: RenderProps) {
    return `${this.options.font}|${this.options.color}|${height}|${value}`;
  }

  getCharacterWidth(character = '') {
    const cached = this.charWidthCache.get(character);
    if (cached) {
      return cached;
    }
    if (this.ctx.font !== this.options.font) {
      this.ctx.font = this.options.font;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
    }
    const width = Math.ceil(this.ctx.measureText(character).width);
    this.charWidthCache.set(character, width);
    return width;
  }

  render({ value = '', height = 0 }: RenderProps) {
    this.canvas.width = this.getCharacterWidth(value);
    this.canvas.height = height;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.ctx.font !== this.options.font) {
      this.ctx.font = this.options.font;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
    }
    if (this.ctx.fillStyle !== this.options.color) {
      this.ctx.fillStyle = this.options.color;
    }

    this.ctx.fillText(value, 0, 0);

    return this.canvas;
  }
}
