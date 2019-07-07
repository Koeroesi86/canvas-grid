import RectangleRenderer from "./rectangle";
import TextRenderer from "./text";

class HeaderRenderer {
  constructor(props = {}) {
    this.options = {
      ...HeaderRenderer.defaultOptions,
      ...props,
    };

    this.rectangleRenderer = new RectangleRenderer({
      canvas: this.options.canvas,
    });

    this.textRenderer = new TextRenderer({
      canvas: this.options.canvas,
      font: this.options.font,
      color: this.options.color,
      clearBeforeRender: false,
      characters: this.options.characters,
    });

    this._hasBottomBorder = !!(this.options.borderBottomWidth > 0 && this.options.borderBottomColor);
    this._hasRightBorder = !!(this.options.borderRightWidth > 0 && this.options.borderRightColor);

    this.render = this.render.bind(this);
  }

  set font(font) {
    this.textRenderer.font = font;
  }

  get font() {
    return this.textRenderer.font;
  }

  render(value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {
    this.rectangleRenderer.color = this.options.background;
    this.rectangleRenderer.render(value, x, y, width, height, isUpdated, isValueUpdated, forcedDraw, diff);

    if (this._hasRightBorder) {
      this.rectangleRenderer.color = this.options.borderRightColor;
      this.rectangleRenderer.render(
        value,
        x + width - this.options.borderRightWidth,
        y,
        this.options.borderRightWidth,
        height,
        isUpdated,
        isValueUpdated,
        forcedDraw,
        diff
      );
    }

    if (this._hasBottomBorder) {
      this.rectangleRenderer.color = this.options.borderBottomColor;
      this.rectangleRenderer.render(
        value,
        x,
        y + height - this.options.borderBottomWidth,
        width,
        this.options.borderBottomWidth,
        isUpdated,
        isValueUpdated,
        forcedDraw,
        diff
      );
    }

    this.textRenderer.color = this.options.color;
    this.textRenderer.render(value, x, y, width, height, isUpdated, isValueUpdated, forcedDraw, diff);
  }
}

HeaderRenderer.defaultOptions = {
  /** @param {HTMLCanvasElement} */
  canvas: null,
  background: '#333',
  font: '13px monospace',
  color: '#fff',
  characters: '',
  borderRightWidth: 1,
  borderRightColor: '#fff',
  borderBottomWidth: 1,
  borderBottomColor: '#fff',
};

export default HeaderRenderer;
