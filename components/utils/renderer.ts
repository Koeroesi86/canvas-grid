import LruCache from './lru-cache';
import { primitive } from './jsx';
import type { RenderProps } from '../types';

abstract class Renderer<Options extends object> {
  readonly options: Options;

  protected constructor(options: Options) {
    this.options = { ...options };
  }

  /** Applies the given options and notifies `optionsUpdated` with the previous ones. */
  update(options: Partial<Options>) {
    const previous = { ...this.options };
    Object.assign(this.options, options);
    this.optionsUpdated(previous);
  }

  optionsUpdated(_previous: Options) {}

  clearCache() {}
}

/**
 * Renderer producing a bitmap from props; usable as a JSX tag through `element`.
 * Bitmaps are reused through a bounded LRU cache whenever `cacheKey` returns a key.
 */
export abstract class CanvasRenderer<Options extends object> extends Renderer<Options> {
  private readonly bitmaps = new LruCache<HTMLCanvasElement>(4096);

  abstract render(props: RenderProps): HTMLCanvasElement;

  /** Props with the same key must render the same pixels. Undefined disables caching. */
  protected cacheKey(_props: RenderProps): string | undefined {
    return undefined;
  }

  clearCache() {
    this.bitmaps.clear();
  }

  paint(ctx: CanvasRenderingContext2D, props: RenderProps, x: number, y: number) {
    const key = this.cacheKey(props);
    const bitmap = (key === undefined ? undefined : this.bitmaps.get(key)) ?? this.renderBitmap(props, key);
    if (bitmap.width <= 0 || bitmap.height <= 0) return;
    ctx.drawImage(bitmap, x + (props.x ?? 0), y + (props.y ?? 0));
  }

  readonly element = primitive<RenderProps>((ctx, props, x, y) => this.paint(ctx, props, x, y));

  private renderBitmap(props: RenderProps, key: string | undefined) {
    const canvas = this.render(props);
    if (key === undefined || canvas.width <= 0 || canvas.height <= 0) return canvas;

    const bitmap = document.createElement('canvas');
    bitmap.width = canvas.width;
    bitmap.height = canvas.height;
    bitmap.getContext('2d')?.drawImage(canvas, 0, 0);
    this.bitmaps.set(key, bitmap);
    return bitmap;
  }
}

export default Renderer;
