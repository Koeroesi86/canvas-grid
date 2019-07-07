import RectangleRenderer from "./rectangle";

class CellBackground {
  constructor(props = {}) {
    this.options = {
      ...CellBackground.defaultOptions,
      ...props,
    };
    this.isScrolling = false;

    this.rectangleRenderer = new RectangleRenderer({
      canvas: this.options.canvas,
      alpha: this.options.alpha,
    });

    this._hasBottomBorder = this.options.borderBottomWidth > 0 && this.options.borderBottomColor;
    this._hasRightBorder = this.options.borderRightWidth > 0 && this.options.borderRightColor;

    this.render = this.render.bind(this);
  }

  render(value = '', x = 0, y = 0, width = 0, height = 0, isUpdated = false, isValueUpdated = false, forcedDraw = false, diff = 0) {
    this.rectangleRenderer.color = this.options.background;
    this.rectangleRenderer.render(value, x, y, width, height, isUpdated, isValueUpdated, forcedDraw, diff);

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
          this.rectangleRenderer.render(value, x, y, width, height, isUpdated, isValueUpdated, forcedDraw, diff);
        }
      }
    }

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
        width, this.options.borderBottomWidth,
        isUpdated,
        isValueUpdated,
        forcedDraw,
        diff
      );
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
