class Renderer {
  constructor(options = {}) {
    this._actualOptions = {
      ...this.constructor.defaultOptions,
      ...options,
    };
    this._options = {};
    Object.keys(this._actualOptions).forEach(key => {
      Object.defineProperty(this._options, key, {
        get: () => this._actualOptions[key],
        set: v => {
          const prevOptions = { ...this._actualOptions };
          this._actualOptions[key] = v;
          this.optionsUpdated(prevOptions);
        }
      })
    });

    this.optionsUpdated = this.optionsUpdated.bind(this);
  }

  set options(options) {
    Object.keys(options).forEach(key => {
      this._options[key] = options[key];
    });
  }

  get options() {
    return this._options;
  }

  optionsUpdated() {}

  clearCache() {}

  preWarmCache() {}

  render(value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {

  }
}

Renderer.defaultOptions = {};

export default Renderer;
