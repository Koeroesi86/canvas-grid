import React from '../utils/jsx';
import { CanvasRenderer } from '../utils/renderer';
import { getContext2d } from '../utils/canvas';
import CharacterRenderer from '../character';
import type { RenderProps } from '../types';

export interface TextOptions {
  ellipsis: string;
  characters: string;
  alpha: boolean;
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

class TextRenderer extends CanvasRenderer<TextOptions> {
  static readonly defaultOptions: TextOptions = {
    ellipsis: '…',
    characters: '',
    alpha: true,
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

  private readonly canvas = document.createElement('canvas');

  private readonly ctx: CanvasRenderingContext2D;

  private readonly characterRenderer: CharacterRenderer;

  constructor(options: Partial<TextOptions> = {}) {
    super({ ...TextRenderer.defaultOptions, ...options });

    this.ctx = getContext2d(this.canvas, { alpha: this.options.alpha });
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

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
  }

  get color() {
    return this.options.color;
  }

  clearCache() {
    this.characterRenderer.clearCache();
    React.invalidateCache((_, key) => /^characterRenderer-/.test(`${key}`));
  }

  preWarmCache() {
    // const { characters } = this.options;
    // for (let i = 0; i < characters.length; i++) {
    //   const character = characters.charAt(i);
    //   const buffer = <this.characterRenderer.element
    //     key={`characterRenderer-${character}-${this.options.font}`}
    //     value={character}
    //     width={this.getTextWidth(character)}
    //     height={50}
    //   />;
    // }
  }

  getTextWidth(text: string) {
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const character = text.charAt(i);
      totalWidth += this.characterRenderer.getCharacterWidth(character);
    }
    return totalWidth;
  }

  render({ value = '', x = 0, y = 0, width = 0, height = 0 }: RenderProps = {}) {
    this.ctx.clearRect(x, y, width, height);

    const ellipsisWidth = this.characterRenderer.getCharacterWidth(this.options.ellipsis);
    const verticalPadding = this.options.cellPadding.left + this.options.cellPadding.right;
    const availableWidth = width - ellipsisWidth - verticalPadding;
    let currentXOffset = this.options.cellPadding.left;
    const yOffset = y + this.options.cellPadding.top;
    const maxHeight = height - this.options.cellPadding.top - this.options.cellPadding.bottom;
    let currentWidth = 0;

    // break down to character for better caching
    for (let i = 0; i < value.length; i++) {
      const character = value.charAt(i);
      const characterWidth = Math.round(this.characterRenderer.getCharacterWidth(character));

      if (Math.ceil(currentWidth + characterWidth) < availableWidth) {
        this.ctx.drawImage(<this.characterRenderer.element
          key={`characterRenderer-${character}-${this.options.font}`}
          value={character}
          width={characterWidth}
          height={maxHeight}
        />, x + currentXOffset, yOffset);
        currentWidth += characterWidth;
        currentXOffset += characterWidth;
      } else {
        this.ctx.drawImage(<this.characterRenderer.element
          key={`characterRenderer-${this.options.ellipsis}-${this.options.font}`}
          value={this.options.ellipsis}
          width={characterWidth}
          height={maxHeight}
        />, x + currentXOffset, yOffset);
        break;
      }
    }

    return this.canvas;
  }
}

export default TextRenderer;
