import Collection from "../utils/collection";
import Renderer from "../utils/renderer";

export default class CharacterRenderer extends Renderer {
  constructor(options = {}) {
    super(options);

    this.charWidthCache = new Collection();

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: this.options.alpha });
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    this.render = this.render.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this.getCharacterWidth = this.getCharacterWidth.bind(this);
  }

  set font(font) {
    if (this.options.font !== font) {
      this.options.font = font;
    }
  }

  clearCache() {
    this.charWidthCache.clear();
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

CharacterRenderer.defaultOptions = {
  font: '12px monospace',
  color: '#fff',
  alpha: true,
  clearBeforeRender: true,
};
