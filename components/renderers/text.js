import Collection from "../utils/collection";
import Renderer from "./renderer";

class TextRenderer extends Renderer {
  constructor(options = {}) {
    super(options);

    this.charWidthCache = new Collection();
    this.fontCache = new Collection();

    this.offCanvas = document.createElement('canvas');
    this.offCtx = this.offCanvas.getContext('2d');
    this.offCtx.textAlign = 'left';
    this.offCtx.textBaseline = 'top';
    if (this.options.canvas) {
      this.ctx = this.options.canvas.getContext('2d', { alpha: this.options.alpha });
    }

    this.render = this.render.bind(this);
    this.drawText = this.drawText.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this.preWarmCache = this.preWarmCache.bind(this);
    this.getTextWidth = this.getTextWidth.bind(this);
    this.getCharacterWidth = this.getCharacterWidth.bind(this);
  }

  set font(font) {
    if (this.options.font !== font) {
      this.options.font = font;
      this.clearCache();
    }
  }

  get font() {
    return this.options.font;
  }

  clearCache() {
    this.fontCache.clear();
    this.charWidthCache.clear();
  }

  preWarmCache() {
    const { characters } = this.options;
    for (let i = 0; i < characters.length; i++) {
      const character = characters.charAt(i);
      this.offCanvas.width = this.getTextWidth(character);
      this.offCanvas.height = 50;
      this.drawText(0, 0, character, this.offCanvas.height, this.offCtx);
    }
  }

  getCharacterWidth(character = '') {
    const cached = this.charWidthCache.get(character);
    if (cached) {
      return cached;
    }
    if (this.offCtx.font !== this.options.font) {
      this.offCtx.font = this.options.font;
      this.offCtx.textAlign = 'left';
      this.offCtx.textBaseline = 'top';
    }
    const width = this.offCtx.measureText(character).width;
    this.charWidthCache.set(character, width);
    return width;
  }

  getTextWidth(text) {
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      totalWidth += this.getCharacterWidth(text.charAt(i));
    }
    return totalWidth;
  }

  drawText(x = 0, y = 0, text = '', maxHeight = 0, ctx) {
    const charWidth = this.getTextWidth(text);
    const cached = this.fontCache.get(text);

    if (cached) {
      (ctx || this.ctx).drawImage(cached, x, y);
    } else {
      const roundedCharWidth = Math.ceil(charWidth);
      if (roundedCharWidth > 0 && maxHeight > 0) {
        const textBuffer = document.createElement('canvas');
        textBuffer.width = roundedCharWidth;
        textBuffer.height = maxHeight;
        const textCtx = textBuffer.getContext('2d');
        textCtx.font = this.options.font;
        textCtx.textAlign = 'left';
        textCtx.textBaseline = 'top';
        textCtx.fillStyle = this.options.color;
        textCtx.fillText(text, 0, 0);
        this.fontCache.set(text, textBuffer);
        (ctx || this.ctx).drawImage(textBuffer, x, y);
      }
    }
  }

  render(value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {
    if (value && ((isValueUpdated || forcedDraw) || isUpdated)) {
      if (this.options.clearBeforeRender) {
        this.ctx.clearRect(x, y, width, height);
      }

      const ellipsisWidth = this.getCharacterWidth(this.options.ellipsis);
      const verticalPadding = this.options.cellPadding.left + this.options.cellPadding.right;
      const availableWidth = width - ellipsisWidth - verticalPadding;
      let currentXOffset = this.options.cellPadding.left;
      const yOffset = y + this.options.cellPadding.top;
      const maxHeight = height - this.options.cellPadding.top - this.options.cellPadding.bottom;
      let currentWidth = 0;

      // break down to character for better caching
      for (let i = 0; i < value.length; i++) {
        const character = value.charAt(i);
        const characterWidth = Math.round(this.getCharacterWidth(character));

        if (Math.ceil(currentWidth + characterWidth) < availableWidth) {
          this.drawText(
            x + currentXOffset,
            yOffset,
            character,
            maxHeight,
            this.ctx
          );
          currentWidth += characterWidth;
          currentXOffset += characterWidth;
        } else {
          this.drawText(
            x + currentXOffset,
            yOffset,
            this.options.ellipsis,
            maxHeight,
            this.ctx
          );
          break;
        }
      }
    }
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
  clearBeforeRender: true,
};

export default TextRenderer;
