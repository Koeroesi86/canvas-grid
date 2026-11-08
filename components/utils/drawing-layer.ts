import type { PositionalRenderer, RenderProps } from '../types';
import { getContext2d } from './canvas';

interface DrawingLayerOptions<Renderer extends PositionalRenderer> {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  alpha?: boolean;
}

class DrawingLayer<Renderer extends PositionalRenderer> {
  readonly renderer: Renderer;

  private readonly canvas: HTMLCanvasElement;

  private readonly ctx: CanvasRenderingContext2D;

  private scrolling = false;

  constructor({ canvas, renderer, alpha = true }: DrawingLayerOptions<Renderer>) {
    this.canvas = canvas;
    this.ctx = getContext2d(canvas, { alpha });
    this.renderer = renderer;

    this.clear = this.clear.bind(this);
  }

  set isScrolling(isScrolling: boolean) {
    this.scrolling = isScrolling;
    this.renderer.isScrolling = isScrolling;
  }

  get isScrolling() {
    return this.scrolling;
  }

  clearCache() {
    this.renderer.clearCache();
  }

  preWarmCache() {
    this.renderer.preWarmCache();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(props: RenderProps) {
    this.renderer.render(props);
  }
}

export default DrawingLayer;
