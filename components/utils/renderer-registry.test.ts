import { afterEach, describe, expect, it, vi } from 'vitest';
import RendererRegistry from './renderer-registry';
import type { CellRenderer } from '../types';

const createRenderer = (layer = 'content'): CellRenderer => ({ layer, draw: vi.fn() });

describe('RendererRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves registered names and passes renderers through', () => {
    const registry = new RendererRegistry();
    const named = createRenderer();
    const direct = createRenderer();
    registry.register('named', named);
    expect(registry.resolve('named')).toBe(named);
    expect(registry.resolve(direct)).toBe(direct);
  });

  it('replaces a renderer registered under the same name and forgets removed ones', () => {
    const registry = new RendererRegistry();
    const replacement = createRenderer();
    registry.register('a', createRenderer());
    registry.register('a', replacement);
    expect(registry.get('a')).toBe(replacement);
    registry.unregister('a');
    expect(registry.get('a')).toBeUndefined();
  });

  it('warns once about an unknown name and returns undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new RendererRegistry();
    expect(registry.resolve('missing')).toBeUndefined();
    expect(registry.resolve('missing')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns again after a missing name was registered and removed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registry = new RendererRegistry();
    registry.resolve('a');
    registry.register('a', createRenderer());
    registry.unregister('a');
    registry.resolve('a');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('clears the caches of renderers that have one', () => {
    const registry = new RendererRegistry();
    const withCache: CellRenderer = { layer: 'a', draw: vi.fn(), clearCache: vi.fn() };
    registry.register('cached', withCache);
    registry.register('plain', createRenderer());
    registry.clearCaches();
    expect(withCache.clearCache).toHaveBeenCalledTimes(1);
  });
});
