import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CellValueRenderer from './index';
import HeaderRenderer from '../header';
import type { CellContext } from '../types';

const createContext = () => {
  const target: Record<string | symbol, unknown> = {};
  return new Proxy(target, {
    get: (store, key) => (key in store ? store[key] : (store[key] = vi.fn())),
    set: (store, key, value) => {
      store[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D & { font: string; fillText: ReturnType<typeof vi.fn> };
};

const cell = (ctx: CanvasRenderingContext2D, column: CellContext['column']) => ({
  ctx,
  x: 0,
  y: 0,
  width: 200,
  height: 20,
  column,
  formatted: 'text',
  valueChanged: true,
  forced: true,
}) as unknown as CellContext;

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ font: '', measureText: () => ({ width: 6 }) }) }) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('per-column fonts', () => {
  it('draws a cell in its column\'s font', () => {
    const ctx = createContext();
    new CellValueRenderer({ font: '12px grid' }).draw(cell(ctx, { id: 'a', index: 0, font: 'bold 14px column' }));
    expect(ctx.font).toBe('bold 14px column');
  });

  it('draws a cell in the grid font when its column has none', () => {
    const ctx = createContext();
    new CellValueRenderer({ font: '12px grid' }).draw(cell(ctx, { id: 'a', index: 0 }));
    expect(ctx.font).toBe('12px grid');
  });

  it('draws row numbers, which have no column, in the grid font', () => {
    const ctx = createContext();
    new CellValueRenderer({ font: '12px grid' }).draw(cell(ctx, undefined));
    expect(ctx.font).toBe('12px grid');
  });

  it('draws a header in its column\'s header font, and not in the cell font', () => {
    const ctx = createContext();
    new HeaderRenderer({ font: '13px header' }).draw(cell(ctx, { id: 'a', index: 0, font: 'bold 14px column', headerFont: 'italic 15px heading' }));
    expect(ctx.font).toBe('italic 15px heading');
  });

  it('draws a header in the header font when its column has none', () => {
    const ctx = createContext();
    new HeaderRenderer({ font: '13px header' }).draw(cell(ctx, { id: 'a', index: 0, font: 'bold 14px column' }));
    expect(ctx.font).toBe('13px header');
  });
});
