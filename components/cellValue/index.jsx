import React from "../utils/jsx";
import Renderer from "../utils/renderer";
import TextRenderer from "../text";

export default class CellValueRenderer extends Renderer {
  constructor(options) {
    super(options);

    this.renderer = new TextRenderer({
      font: this.options.font,
      color: this.options.color,
      characters: this.options.characters,
    });

    this.ctx = this.options.canvas.getContext('2d', { alpha: this.options.alpha });

    this._isScrolling = false;
    this.clearCache = this.clearCache.bind(this);
    this.preWarmCache = this.preWarmCache.bind(this);
    this.render = this.render.bind(this);
  }

  set font(font) {
    this.options.font = font;
    this.renderer.font = font;
  }

  get font() {
    return this.options.font;
  }

  set color(color) {
    this.options.color = color;
    this.renderer.color = color;
  }

  get color() {
    return this.options.color;
  }

  set isScrolling(isScrolling) {
    this._isScrolling = isScrolling;
  }

  get isScrolling() {
    return this._isScrolling;
  }

  clearCache() {
    this.renderer.clearCache();
    React.invalidateCache((_, key) => /^cellValue-/.test(key))
  }

  preWarmCache() {
    this.renderer.preWarmCache();
  }

  render(value, x, y, width, height, isUpdated, isValueUpdated, forcedDraw, diff) {
    if (isValueUpdated || forcedDraw) {
      this.ctx.clearRect(x, y, width, height);
      this.ctx.drawImage(<this.renderer
        value={value}
        x={0}
        y={0}
        width={width}
        height={height}
        isUpdated={isUpdated}
        isValueUpdated={isValueUpdated}
        forcedDraw={forcedDraw}
        diff={diff}
      />, x, y);
    }
  }
}

CellValueRenderer.defaultOptions = {
  font: '12px monospace',
  color: '#fff',
  characters: ''
};
