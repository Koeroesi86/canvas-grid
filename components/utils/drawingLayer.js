import Renderer from "../renderers/renderer";

class DrawingLayer {
  constructor(options = {}) {
    this.options = {
      ...DrawingLayer.defaultOptions,
      ...options,
    };
    if (this.options.canvas) {
      this.ctx = this.options.canvas.getContext('2d', { alpha: this.options.alpha });
    }

    if (this.options.renderer) {
      this.renderer = this.options.renderer;
      this.render = this.renderer.render;
    } else {
      console.warn('No renderer specified for drawing layer.');
      this.renderer = new Renderer();
    }

    if (this.renderer.clearCache) {
      this.clearCache = this.renderer.clearCache;
    }
    if (this.renderer.preWarmCache) {
      this.preWarmCache = this.renderer.preWarmCache;
    }

    this.clear = this.clear.bind(this);
  }

  set isScrolling(isScrolling) {
    this._isScrolling = isScrolling;
    this.renderer.isScrolling = isScrolling;
  }

  get isScrolling() {
    return this._isScrolling;
  }

  clearCache() {

  }

  preWarmCache() {

  }

  clear () {
    this.ctx.clearRect(0, 0, this.options.canvas.width, this.options.canvas.height);
  }

  render(value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {

  }
}

DrawingLayer.defaultOptions = {
  /** @param {HTMLElement} */
  host: null,
  /** @param {HTMLCanvasElement} */
  canvas: null,
  alpha: true,
  renderer: null,
};

export default DrawingLayer;
