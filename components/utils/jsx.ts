import Collection from './collection';
import type { CanvasElement, Key, RenderProps } from '../types';

export type Attributes = RenderProps & { key?: string };

interface CachedBuffer {
  element: CanvasElement;
  buffer: HTMLCanvasElement;
  cached: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    type Element = HTMLCanvasElement;
    interface IntrinsicElements {}
    interface IntrinsicAttributes {
      key?: string;
    }
  }
}

const cache = new Collection<CachedBuffer>();

const React = {
  cache,
  invalidateCache(matcher: (item: CachedBuffer, key: Key) => boolean) {
    cache.clear(matcher);
  },
  createElement(element: CanvasElement, attrs: Attributes | null = null): HTMLCanvasElement {
    const canvas = element(attrs ?? {});

    if (attrs && attrs.key !== undefined) {
      const key = attrs.key;
      const cached = cache.get(key);
      if (cached && cached.element === element) return cached.buffer;

      if (canvas.width > 0 && canvas.height > 0) {
        const buffer = document.createElement('canvas');
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        buffer.getContext('2d')?.drawImage(canvas, 0, 0);
        cache.set(key, { element, buffer, cached: Date.now() });
        // TODO: automatic invalidation?
        // setTimeout(( )=> {
        //   JSX.cache.delete(key);
        // }, 5000)
      }
    }

    // TODO: child element rendering

    return canvas;
  },
};

export default React;
