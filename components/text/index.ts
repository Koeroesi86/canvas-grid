import Renderer from '../utils/renderer';
import { primitive } from '../utils/jsx';
import fitText from '../utils/fit-text';
import { getContext2d } from '../utils/canvas';
import type { RenderProps } from '../types';

export interface TextOptions {
  ellipsis: string;
  cellPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  font: string;
  color: string;
  isEllipsisRight: boolean;
}

class TextRenderer extends Renderer<TextOptions> {
  static readonly defaultOptions: TextOptions = {
    ellipsis: '…',
    cellPadding: {
      top: 3,
      right: 3,
      bottom: 3,
      left: 3,
    },
    font: '12px monospace',
    color: '#fff',
    isEllipsisRight: true,
  };

  private readonly characterWidths = new Map<string, number>();

  private readonly measureContext = getContext2d(document.createElement('canvas'));

  private measuredFont = '';

  constructor(options: Partial<TextOptions> = {}) {
    super({ ...TextRenderer.defaultOptions, ...options });
  }

  set font(font: string) {
    if (this.options.font !== font) {
      this.options.font = font;
      this.clearCache();
    }
  }

  get font() {
    return this.options.font;
  }

  set color(color: string) {
    this.options.color = color;
  }

  get color() {
    return this.options.color;
  }

  /** Text is drawn straight into the layer, whose transform already scales it to the device pixel ratio. */
  pixelRatio = 1;

  clearCache() {
    this.characterWidths.clear();
    this.measuredFont = '';
  }

  /** Width of one character in the current font, measured once. */
  private measureCharacter(character: string) {
    const cached = this.characterWidths.get(character);
    if (cached !== undefined) return cached;

    if (this.measuredFont !== this.options.font) {
      this.measureContext.font = this.options.font;
      this.measuredFont = this.options.font;
    }
    const width = this.measureContext.measureText(character).width;
    this.characterWidths.set(character, width);
    return width;
  }

  getTextWidth(text: string) {
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) totalWidth += this.measureCharacter(text.charAt(i));
    return totalWidth;
  }

  /**
   * Draws the text clipped with an ellipsis; `(x, y)` is the offset of the text box from `(originX, originY)`.
   * The whole string is drawn with one `fillText`: recording one command per cell is much cheaper than
   * one `drawImage` per character, and the browser keeps its own glyph cache.
   */
  paint(ctx: CanvasRenderingContext2D, { value = '', x = 0, y = 0, width = 0, height = 0 }: RenderProps, originX: number, originY: number) {
    const { cellPadding } = this.options;
    const available = width - cellPadding.left - cellPadding.right;
    const text = fitText(value, available, this.options.ellipsis, character => this.measureCharacter(character));
    if (text === '' || height - cellPadding.top - cellPadding.bottom <= 0) return;

    ctx.font = this.options.font;
    ctx.fillStyle = this.options.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, originX + x + cellPadding.left, originY + y + cellPadding.top);
  }

  readonly element = primitive<RenderProps>((ctx, props, x, y) => this.paint(ctx, props, x, y));
}

export default TextRenderer;
