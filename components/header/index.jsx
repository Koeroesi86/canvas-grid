import React from "../utils/jsx";
import RectangleRenderer from "../rectangle";
import TextRenderer from "../text";
import Renderer from "../utils/renderer";

class HeaderRenderer extends Renderer {
  constructor(options) {
    super(options);

    this.rectangleRenderer = new RectangleRenderer({

    });

    this.textRenderer = new TextRenderer({
      canvas: this.options.canvas,
      font: this.options.font,
      color: this.options.color,
      characters: this.options.characters,
    });
    this.ctx = this.options.canvas.getContext('2d', { alpha: true });

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
    if (width === 0 || height === 0) return this.canvas;
    this.rectangleRenderer.color = this.options.background;
    this.ctx.drawImage(<this.rectangleRenderer
      key={`headerBackground-${this.rectangleRenderer.color}-${width}-${height}`}
      width={width}
      height={height}
    />, x, y);

    if (this._hasRightBorder) {
      this.rectangleRenderer.color = this.options.borderRightColor;
      this.ctx.drawImage(
        <this.rectangleRenderer
          key={`headerBorder-${this.rectangleRenderer.color}-${this.options.borderRightWidth}-${height}`}
          height={height}
          width={this.options.borderRightWidth}
        />,
        x + width - this.options.borderRightWidth,
        y
      );
    }

    if (this._hasBottomBorder) {
      this.rectangleRenderer.color = this.options.borderBottomColor;
      this.ctx.drawImage(
        <this.rectangleRenderer
          key={`headerBorder-${this.rectangleRenderer.color}-${width}-${this.options.borderBottomWidth}`}
          width={width}
          height={this.options.borderBottomWidth}
        />,
        x,
        y + height - this.options.borderBottomWidth
      );
    }

    this.textRenderer.color = this.options.color;
    this.ctx.drawImage(<this.textRenderer
      key={`headerText-${value}-${this.textRenderer.font}`}
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
