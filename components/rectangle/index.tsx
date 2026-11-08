import { CanvasRenderer } from '../utils/renderer';
import { getContext2d } from '../utils/canvas';
import type { RenderProps } from '../types';

export interface RectangleOptions {
  alpha: boolean;
  color: string;
}

class RectangleRenderer extends CanvasRenderer<RectangleOptions> {
  static readonly defaultProps: Required<RenderProps> = {
    value: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    isUpdated: false,
    isValueUpdated: false,
    forcedDraw: false,
    diff: 0,
  };

  static readonly defaultOptions: RectangleOptions = {
    alpha: true,
    color: '#000',
  };

  private readonly canvas = document.createElement('canvas');

  private readonly ctx: CanvasRenderingContext2D;

  constructor(options: Partial<RectangleOptions> = {}) {
    super({ ...RectangleRenderer.defaultOptions, ...options });

    this.ctx = getContext2d(this.canvas, { alpha: this.options.alpha });
  }

  set color(color: string) {
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

  render(p: RenderProps = {}) {
    const props = {
      ...RectangleRenderer.defaultProps,
      ...p,
    };
    this.canvas.width = props.width;
    this.canvas.height = props.height;
    this.clearBackground(props.x, props.y, props.width, props.height);
    if (this.options.color) this.drawBackground(props.x, props.y, props.width, props.height);

    return this.canvas;
  }
}

export default RectangleRenderer;
