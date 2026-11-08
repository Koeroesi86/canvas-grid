import Renderer from '../utils/renderer';
import { primitive } from '../utils/jsx';
import CharacterRenderer from '../character';
import type { RenderProps } from '../types';

export interface TextOptions {
  ellipsis: string;
  characters: string;
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
    characters: '',
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

  private readonly characterRenderer: CharacterRenderer;

  constructor(options: Partial<TextOptions> = {}) {
    super({ ...TextRenderer.defaultOptions, ...options });

    this.characterRenderer = new CharacterRenderer({
      font: this.options.font,
      color: this.options.color,
    });
  }

  set font(font: string) {
    if (this.options.font !== font) {
      this.options.font = font;
      this.characterRenderer.font = font;
      this.clearCache();
    }
  }

  get font() {
    return this.options.font;
  }

  set color(color: string) {
    this.options.color = color;
    this.characterRenderer.color = color;
  }

  get color() {
    return this.options.color;
  }

  clearCache() {
    this.characterRenderer.clearCache();
  }

  getTextWidth(text: string) {
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const character = text.charAt(i);
      totalWidth += this.characterRenderer.getCharacterWidth(character);
    }
    return totalWidth;
  }

  /** Draws the text clipped with an ellipsis; `(x, y)` is the offset of the text box from `(originX, originY)`. */
  paint(ctx: CanvasRenderingContext2D, { value = '', x = 0, y = 0, width = 0, height = 0 }: RenderProps, originX: number, originY: number) {
    const ellipsisWidth = this.characterRenderer.getCharacterWidth(this.options.ellipsis);
    const verticalPadding = this.options.cellPadding.left + this.options.cellPadding.right;
    const availableWidth = width - ellipsisWidth - verticalPadding;
    const left = originX + x;
    const top = originY + y + this.options.cellPadding.top;
    const maxHeight = height - this.options.cellPadding.top - this.options.cellPadding.bottom;
    let currentXOffset = this.options.cellPadding.left;
    let currentWidth = 0;

    // break down to character for better caching; characters are drawn directly, no per-glyph elements
    for (let i = 0; i < value.length; i++) {
      const character = value.charAt(i);
      const characterWidth = Math.round(this.characterRenderer.getCharacterWidth(character));

      if (Math.ceil(currentWidth + characterWidth) >= availableWidth) {
        this.characterRenderer.paint(ctx, { value: this.options.ellipsis, height: maxHeight }, left + currentXOffset, top);
        break;
      }
      this.characterRenderer.paint(ctx, { value: character, height: maxHeight }, left + currentXOffset, top);
      currentWidth += characterWidth;
      currentXOffset += characterWidth;
    }
  }

  readonly element = primitive<RenderProps>((ctx, props, x, y) => this.paint(ctx, props, x, y));
}

export default TextRenderer;
