import type { CanvasElement, RenderProps } from '../types';

abstract class Renderer<Options extends object> {
  private readonly actualOptions: Options;

  private readonly optionsProxy: Options;

  protected constructor(options: Options) {
    this.actualOptions = { ...options };
    this.optionsProxy = new Proxy(this.actualOptions, {
      set: (target, key, value) => {
        const prevOptions = { ...target };
        const result = Reflect.set(target, key, value);
        this.optionsUpdated(prevOptions);
        return result;
      },
    });
  }

  set options(options: Partial<Options>) {
    Object.assign(this.optionsProxy, options);
  }

  get options(): Options {
    return this.optionsProxy;
  }

  optionsUpdated(_prevOptions: Options) {}

  clearCache() {}

  preWarmCache() {}
}

/** Renderer producing a canvas from props; usable as a JSX tag through `element`. */
export abstract class CanvasRenderer<Options extends object> extends Renderer<Options> {
  abstract render(props?: RenderProps): HTMLCanvasElement;

  readonly element: CanvasElement = props => this.render(props);
}

export default Renderer;
