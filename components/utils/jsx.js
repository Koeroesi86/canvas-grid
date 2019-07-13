import Collection from "./collection";

/**
 * @typedef Attributes
 * @property {String} [key]
 **/


/**
 * @type {{cache: Collection, invalidateCache(*=): void, createElement(Renderer, Attributes, Array<Renderer>): HTMLCanvasElement}}
 */
const JSX = {
  cache: new Collection(),
  invalidateCache(matcher) {
    JSX.cache.clear(matcher);
  },
  bufferNode: document.createElement('canvas'),
  /**
   * @param {Renderer} renderer
   * @param {Attributes} attrs
   * @param {Array<Renderer>} children
   * */
  createElement(renderer, attrs, children) {
    let key;
    const buffer = JSX.bufferNode.cloneNode();
    if (attrs && attrs.key !== undefined) {
      key = attrs.key;
      const cached = JSX.cache.get(key);
      if (cached && cached.renderer === renderer) return cached.buffer;
    }
    if (renderer) {
      const canvas = renderer.render(attrs);
      if (canvas.width > 0 && canvas.height > 0) {
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        const ctx = buffer.getContext('2d');
        ctx.drawImage(canvas, 0, 0);
        if (key !== undefined) {
          JSX.cache.set(key, { renderer, buffer, cached: Date.now() });
          // TODO: automatic invalidation?
          // setTimeout(( )=> {
          //   JSX.cache.delete(key);
          // }, 5000)
        }

        // TODO: child element rendering
        // if (Array.isArray(children)) {
        //   children.forEach(child => {
        //     const result = JSX.createElement();
        //     ctx.drawImage(canvas, 0, 0);
        //   })
        // }
      }
    }

    return buffer;
  }
};

export default JSX;
