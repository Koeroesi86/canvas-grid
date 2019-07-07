class RectangleRenderer {
  constructor(props = {}) {
    this.options = {
      ...RectangleRenderer.defaultOptions,
      ...props,
    };

    if (this.options.canvas) {
      this.ctx = this.options.canvas.getContext('2d', { alpha: this.options.alpha });
    }

    this.drawBackground = this.drawBackground.bind(this);
    this.clearBackground = this.clearBackground.bind(this);
    this.render = this.render.bind(this);
  }

  set color(color) {
    this.options.color = color;
  }

  get color() {
    return this.options.color;
  }

  clearBackground(x = 0, y = 0, width = 0, height = 0) {
    if (!this.ctx) return;

    this.ctx.clearRect(x, y, width, height);
  }

  drawBackground(x = 0, y = 0, width = 0, height = 0) {
    if (!this.ctx) return;

    this.ctx.fillStyle = this.options.color;
    this.ctx.fillRect(x, y, width, height);
  }

  render (value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {
    if (this.options.color) {
      this.drawBackground(x, y, width, height);
    } else {
      this.clearBackground(x, y, width, height);
    }
  }
}

RectangleRenderer.defaultOptions = {
  /** @param {HTMLCanvasElement} */
  canvas: null,
  alpha: true,
  color: '#000'
};

export default RectangleRenderer;
