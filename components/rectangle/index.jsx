import Renderer from "../utils/renderer";

class RectangleRenderer extends Renderer {
  constructor(options) {
    super(options);

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: this.options.alpha });

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
    this.ctx.clearRect(x, y, width, height);
  }

  drawBackground(x = 0, y = 0, width = 0, height = 0) {
    if (this.ctx.fillStyle !== this.options.color) {
      this.ctx.fillStyle = this.options.color;
    }
    this.ctx.fillRect(x, y, width, height);
  }

  render(p = {}) {
    const props = {
      ...RectangleRenderer.defaultProps,
      ...p
    };
    this.canvas.width = props.width;
    this.canvas.height = props.height;
    this.clearBackground(props.x, props.y, props.width, props.height);
    if (this.options.color) this.drawBackground(props.x, props.y, props.width, props.height);

    return this.canvas;
  }
}

RectangleRenderer.defaultProps = {
  value: '',
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  isUpdated: false,
  isValueUpdated: false,
  forcedDraw: false,
  diff: 0
};

RectangleRenderer.defaultOptions = {
  alpha: true,
  color: '#000'
};

export default RectangleRenderer;
