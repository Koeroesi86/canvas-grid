import React from '../utils/jsx';
import Renderer from "../utils/renderer";
import CharacterRenderer from "../character";

class TextRenderer extends Renderer {
  constructor(options = {}) {
    super(options);

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: this.options.alpha });
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    this.characterRenderer = new CharacterRenderer({
      font: this.options.font,
      color: this.options.color,
    });

    this.render = this.render.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this.preWarmCache = this.preWarmCache.bind(this);
    this.getTextWidth = this.getTextWidth.bind(this);
  }

  set font(font) {
    if (this.options.font !== font) {
      this.options.font = font;
      this.characterRenderer.font = font;
      this.clearCache();
    }
  }

  get font() {
    return this.options.font;
  }

  clearCache() {
    this.characterRenderer.clearCache();
    React.invalidateCache((_, key) => /^characterRenderer-/.test(key))
  }

  preWarmCache() {
    // const { characters } = this.options;
    // for (let i = 0; i < characters.length; i++) {
    //   const character = characters.charAt(i);
    //   const buffer = <this.characterRenderer
    //     key={`characterRenderer-${character}-${this.options.font}`}
    //     value={character}
    //     width={this.getTextWidth(character)}
    //     height={50}
    //   />;
    // }
  }

  getTextWidth(text) {
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const character = text.charAt(i);
      totalWidth += this.characterRenderer.getCharacterWidth(character);
    }
    return totalWidth;
  }

  render(props = {}) {
    const {
      value = '',
      x = 0,
      y = 0,
      width = 0,
      height = 0,
      isUpdated = false,
      isValueUpdated = false,
      forcedDraw = false,
      diff = 0
    } = props;
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
        this.ctx.drawImage(<this.characterRenderer
          key={`characterRenderer-${character}-${this.options.font}`}
          value={character}
          width={characterWidth}
          height={maxHeight}
        />, x + currentXOffset, yOffset);
        currentWidth += characterWidth;
        currentXOffset += characterWidth;
      } else {
        this.ctx.drawImage(<this.characterRenderer
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

TextRenderer.defaultOptions = {
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
  canvas: null,
};

export default TextRenderer;
