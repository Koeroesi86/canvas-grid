import { getContext2d } from './canvas';

export interface LayerOptions {
  /** Transparent canvas. Opaque layers (`false`) draw faster; keep the bottom layer opaque. */
  alpha?: boolean;
  /** Lets the browser present frames without syncing to the compositor: lower latency, but may tear. Off by default. */
  desynchronized?: boolean;
  /** Name of an existing layer to stack this one below; defaults to the top. */
  before?: string;
}

/** A named canvas stacked in the grid; renderers draw into its context. */
class Layer {
  readonly name: string;

  readonly canvas = document.createElement('canvas');

  readonly ctx: CanvasRenderingContext2D;

  constructor(name: string, { alpha = true, desynchronized = false }: Pick<LayerOptions, 'alpha' | 'desynchronized'> = {}) {
    this.name = name;
    this.canvas.className = `drawingLayer ${name}`;
    this.ctx = getContext2d(this.canvas, { alpha, desynchronized });
  }

  /** Size in CSS pixels; the backing store is `pixelRatio` times larger. */
  width = 0;

  height = 0;

  pixelRatio = 1;

  /**
   * Resizes the canvas, scaling the context so renderers keep drawing in CSS pixels.
   * Returns false, leaving the canvas untouched, when nothing changed (assigning a size clears the canvas).
   */
  resize(width: number, height: number, pixelRatio = 1) {
    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) return false;

    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    return true;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}

export default Layer;
