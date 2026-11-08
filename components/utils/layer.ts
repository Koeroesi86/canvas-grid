import { getContext2d } from './canvas';

export interface LayerOptions {
  /** Transparent canvas. Opaque layers (`false`) draw faster; keep the bottom layer opaque. */
  alpha?: boolean;
  /** Name of an existing layer to stack this one below; defaults to the top. */
  before?: string;
}

/** A named canvas stacked in the grid; renderers draw into its context. */
class Layer {
  readonly name: string;

  readonly canvas = document.createElement('canvas');

  readonly ctx: CanvasRenderingContext2D;

  constructor(name: string, { alpha = true }: Pick<LayerOptions, 'alpha'> = {}) {
    this.name = name;
    this.canvas.className = `drawingLayer ${name}`;
    this.ctx = getContext2d(this.canvas, { alpha });
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

export default Layer;
