import Collection from "./collection";

const getColorMixCacheKey = ({ background, foreground }) => `${background}-${foreground}`;

class CellRenderer {
  constructor(options = {}) {
    const {
      ellipsis = '…',
      enableFlashing = true,
      flashInDuration = 200,
      flashOutDuration = 400,
      flashRGB = '214, 144, 13',
      cellPadding = {},
      ctx,
      bgCtx,
      font = '12px monospace',
      background = '#000',
      color = '#fff',
      isEllipsisRight = true,
      borderRightWidth = 0,
      borderRightColor = '#fff',
      borderBottomWidth = 0,
      borderBottomColor = '#fff',
    } = options;
    this.ellipsis = ellipsis;
    this.enableFlashing = enableFlashing;
    this.isScrolling = false;
    this.flashInDuration = flashInDuration;
    this.flashOutDuration = flashOutDuration;
    this.flashRGB = flashRGB;
    this.cellPadding = {
      top: 3,
      right: 3,
      bottom: 3,
      left: 3,
      ...cellPadding,
    };
    this.font = font;
    this.background = background;
    this.color = color;
    this.isEllipsisRight = isEllipsisRight;
    this.borderRightWidth = borderRightWidth;
    this.borderRightColor = borderRightColor;
    this.borderBottomWidth = borderBottomWidth;
    this.borderBottomColor = borderBottomColor;
    this.offCanvas = document.createElement('canvas');
    this.offCtx = this.offCanvas.getContext('2d');
    this.offCtx.textAlign = 'left';
    this.offCtx.textBaseline = 'top';
    if (ctx) {
      this.ctx = ctx;
    }
    if (bgCtx) {
      this.bgCtx = bgCtx;
    }

    this.charWidthCache = new Collection();
    this.fontCache = new Collection();

    this.render = this.render.bind(this);
    this.drawText = this.drawText.bind(this);
    this.drawBackground = this.drawBackground.bind(this);
    this.clearBackground = this.clearBackground.bind(this);
    this.clearCache = this.clearCache.bind(this);
  }

  clearCache() {
    this.fontCache.clear();
    this.charWidthCache.clear();
  }

  preWarmCache(props = {}) {
    const {
      characters = '',
      font = '12px monospace',
      color = '#fff',
    } = props;
    for (let i = 0; i < characters.length; i++) {
      const character = characters.charAt(i);
      this.offCanvas.width = this.getTextWidth(character, font);
      this.offCanvas.height = 50;
      this.drawText(0, 0, character, font, color, this.offCanvas.height, this.offCtx);
    }
  }

  drawBackground(x = 0, y = 0, background = '#000', width = 0, height = 0) {
    const ctx = this.bgCtx || this.ctx;
    if (!ctx) return;

    ctx.fillStyle = background;
    ctx.fillRect(x, y, width, height);
  }

  clearBackground(x = 0, y = 0, width = 0, height = 0, ctx) {
    (ctx || this.ctx).clearRect(x, y, width, height);
  }

  drawText(x = 0, y = 0, text = '', font = '', color = '#fff', maxHeight = 0, ctx) {
    const charWidth = this.getTextWidth(text, font);
    const cacheKey = `${text}-${font}-${color}`;
    const cached = this.fontCache.get(cacheKey);

    if (cached) {
      (ctx || this.ctx).drawImage(cached, x, y);
    } else {
      const roundedCharWidth = Math.ceil(charWidth);
      if (roundedCharWidth > 0 && maxHeight > 0) {
        const textBuffer = document.createElement('canvas');
        textBuffer.width = roundedCharWidth;
        textBuffer.height = maxHeight;
        const textCtx = textBuffer.getContext('2d');
        textCtx.font = font;
        textCtx.textAlign = 'left';
        textCtx.textBaseline = 'top';
        textCtx.fillStyle = color;
        textCtx.fillText(text, 0, 0);
        this.fontCache.set(cacheKey, textBuffer);
        (ctx || this.ctx).drawImage(textBuffer, x, y);
      }
    }
  }

  getCharacterWidth(character = '', font) {
    const cacheKey = `${character}-${font}`;
    const cached = this.charWidthCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    if (this.offCtx.font !== font) {
      this.offCtx.font = font;
    }
    const width = this.offCtx.measureText(character).width;
    this.charWidthCache.set(cacheKey, width);
    return width;
  }

  getTextWidth(text, font) {
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      totalWidth += this.getCharacterWidth(text.charAt(i), font);
    }
    return totalWidth;
  }

  render(value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {
    if (!this.enableFlashing || this.isScrolling) {
      if (this.background) {
        this.drawBackground(x, y, this.background, width, height);
      } else {
        this.clearBackground(x, y, width, height);
      }
    } else {
      let alpha = 0;
      if (diff < this.flashInDuration) {
        alpha = (diff / this.flashInDuration).toFixed(2)
      } else if (diff > this.flashInDuration && diff <= (this.flashInDuration + this.flashOutDuration)) {
        alpha = (1 - ((diff - this.flashInDuration) / this.flashOutDuration)).toFixed(2)
      }
      this.drawBackground(x, y, this.background, width, height);
      if (alpha > 0) {
        this.drawBackground(x, y, `rgba(${this.flashRGB}, ${alpha})`, width, height);
      }
    }

    if (this.borderRightWidth && this.borderRightColor) {
      this.drawBackground(
        x + width - this.borderRightWidth,
        y,
        this.borderRightColor,
        this.borderRightWidth,
        height,
      );
    }

    if (this.borderBottomWidth && this.borderBottomColor) {
      this.drawBackground(
        x,
        y + height - this.borderBottomWidth,
        this.borderBottomColor,
        width,
        this.borderBottomWidth
      );
    }

    if (value && ((isValueUpdated || forcedDraw) || (!this.bgCtx && isUpdated))) {
      if (this.bgCtx) {
        this.clearBackground(x, y, width, height, this.ctx);
      }

      let displayText = ('' + value);
      if (displayText.length === 0) return;
      let totalWidth = this.getTextWidth(displayText, this.font);
      const ellipsisWidth = this.getCharacterWidth(this.ellipsis, this.font);
      const verticalPadding = this.cellPadding.left + this.cellPadding.right;
      const availableWidth = width - ellipsisWidth - this.borderRightWidth - verticalPadding;
      if (totalWidth > availableWidth) {
        let currentWidth = 0;
        let parsed = '';
        for (let i = 0; i < displayText.length; i++) {
          const character = displayText.charAt(i);
          const characterWidth = this.getCharacterWidth(character, this.font);
          if (Math.ceil(currentWidth + characterWidth) < availableWidth) {
            currentWidth += characterWidth;
            parsed += character;
          } else {
            break;
          }
        }
        displayText = this.isEllipsisRight ? parsed + this.ellipsis : this.ellipsis + parsed;
      }

      let currentXOffset = this.cellPadding.left;
      const yOffset = y + this.cellPadding.top;
      const maxHeight = height - this.cellPadding.top - this.cellPadding.bottom;
      // break down to character for better caching
      for (let i = 0; i < displayText.length; i++) {
        const character = displayText.charAt(i);
        const characterWidth = Math.round(this.getCharacterWidth(character, this.font));
        this.drawText(
          x + currentXOffset,
          yOffset,
          character,
          this.font,
          this.color,
          maxHeight,
          this.ctx
        );
        currentXOffset += characterWidth;
      }
    }
  }
}

export default CellRenderer;
