class Renderer {
  constructor(options = {}) {
    this._options = {
      ...this.constructor.defaultOptions,
      ...options,
    };
  }

  set options(options) {
    this._options = options;
  }

  get options() {
    return this._options;
  }

  clearCache() {}

  preWarmCache() {}

  render(value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {

  }
}

Renderer.defaultOptions = {};

export default Renderer;
