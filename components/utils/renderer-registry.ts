import type { CellRenderer, RendererRef } from '../types';

/** Named renderers; columns refer to them by name or hand over a renderer directly. */
class RendererRegistry {
  private readonly renderers = new Map<string, CellRenderer>();

  private readonly warned = new Set<string>();

  register(name: string, renderer: CellRenderer) {
    this.renderers.set(name, renderer);
    this.warned.delete(name);
  }

  unregister(name: string) {
    this.renderers.delete(name);
  }

  get(name: string) {
    return this.renderers.get(name);
  }

  /** Resolves a reference without allocating; unknown names are reported once and yield undefined. */
  resolve(ref: RendererRef): CellRenderer | undefined {
    if (typeof ref !== 'string') return ref;

    const renderer = this.renderers.get(ref);
    if (!renderer && !this.warned.has(ref)) {
      this.warned.add(ref);
      console.warn(`canvas-grid: no renderer registered as "${ref}"`);
    }
    return renderer;
  }

  clearCaches() {
    this.renderers.forEach(renderer => renderer.clearCache?.());
  }
}

export default RendererRegistry;
