import React from '../utils/jsx';
import Renderer from "../utils/renderer";
import RectangleRenderer from "../rectangle";

class CellBackground extends Renderer {
  constructor(options) {
    super(options);
    this.isScrolling = false;

    this.rectangleRenderer = new RectangleRenderer({
      // canvas: this.options.canvas,
      alpha: this.options.alpha,
    });
    this.ctx = this.options.canvas.getContext('2d', { alpha: this.options.alpha });

    this._hasBottomBorder = this.options.borderBottomWidth > 0 && this.options.borderBottomColor;
    this._hasRightBorder = this.options.borderRightWidth > 0 && this.options.borderRightColor;

    this.render = this.render.bind(this);
  }

  render(value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {
    this.rectangleRenderer.color = this.options.background;
    this.ctx.drawImage(<this.rectangleRenderer
      key={`cellBackground-${this.rectangleRenderer.color}-${width}-${height}`}
      width={width}
      height={height}
    />, x, y);

    if (this.options.enableFlashing && !this.isScrolling) {
      let alpha = 0;
      const totalFlashDuration = this.options.flashInDuration + this.options.flashOutDuration;
      if (diff <= totalFlashDuration) {
        if (diff < this.options.flashInDuration) {
          alpha = (diff / this.options.flashInDuration);
        } else if (diff > this.options.flashInDuration && diff <= totalFlashDuration) {
          alpha = ((totalFlashDuration - diff) / this.options.flashOutDuration);
        }

        if (alpha > 0) {
          this.rectangleRenderer.color = `rgba(${this.options.flashRGB}, ${alpha.toFixed(3)})`;
          this.ctx.drawImage(<this.rectangleRenderer
            key={`cellBackground-${this.rectangleRenderer.color}-${width}-${height}`}
            width={width}
            height={height}
          />, x, y);
        }
      }
    }

    if (this._hasRightBorder) {
      this.rectangleRenderer.color = this.options.borderRightColor;
      this.ctx.drawImage(<this.rectangleRenderer
        key={`cellBorder-${this.rectangleRenderer.color}-${this.options.borderRightWidth}-${height}`}
        width={this.options.borderRightWidth}
        height={height}
      />, x + width - this.options.borderRightWidth, y);
    }

    if (this._hasBottomBorder) {
      this.rectangleRenderer.color = this.options.borderBottomColor;
      this.ctx.drawImage(<this.rectangleRenderer
        key={`cellBorder-${this.rectangleRenderer.color}-${width}-${this.options.borderBottomWidth}`}
        width={width}
        height={this.options.borderBottomWidth}
      />, x, y + height - this.options.borderBottomWidth);
    }
  }
}

CellBackground.defaultOptions = {
  /** @param {HTMLCanvasElement} */
  canvas: null,
  enableFlashing: true,
  background: '#333',
  alpha: true,
  flashInDuration: 200,
  flashOutDuration: 400,
  flashRGB: '214, 144, 13',
  borderRightWidth: 0,
  borderRightColor: '#fff',
  borderBottomWidth: 0,
  borderBottomColor: '#fff',
};

export default CellBackground;
