import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HeaderRenderer from '.';
import type { CellContext } from '../types';

const measureContext = { font: '', measureText: (text: string) => ({ width: 8 * text.length }) };

beforeEach(() => {
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => measureContext }) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const createCell = (columnId: string, overrides: Partial<CellContext> = {}): CellContext => {
  const ctx = {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    fill: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    row: undefined,
    column: { id: columnId, index: 0, displayName: columnId },
    value: undefined,
    formatted: columnId,
    updatedAt: undefined,
    age: Infinity,
    now: 0,
    dt: 0,
    valueChanged: true,
    forced: true,
    isScrolling: false,
    selected: 'none',
    state: {},
    ...overrides,
  };
};

describe('HeaderRenderer sort indicator', () => {
  const arrows = (renderer: HeaderRenderer, columnId: string) => {
    const cell = createCell(columnId);
    renderer.draw(cell);
    return (cell.ctx.fill as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
  };

  it('draws an arrow only on the sorted columns', () => {
    const renderer = new HeaderRenderer();
    renderer.setSortModel([{ columnId: 'price', direction: 'desc' }]);
    expect(arrows(renderer, 'price')).toBe(1);
    expect(arrows(renderer, 'name')).toBe(0);
  });

  it('treats a key without direction as ascending, and number ids as their text', () => {
    const renderer = new HeaderRenderer();
    renderer.setSortModel([{ columnId: 3 }]);
    expect(arrows(renderer, '3')).toBe(1);
  });

  it('removes the arrows with an empty model', () => {
    const renderer = new HeaderRenderer();
    renderer.setSortModel([{ columnId: 'price' }]);
    renderer.setSortModel([]);
    expect(arrows(renderer, 'price')).toBe(0);
  });

  it('keeps the title clear of the arrow', () => {
    const renderer = new HeaderRenderer();
    renderer.setSortModel([{ columnId: 'a-very-long-title' }]);
    const cell = createCell('a-very-long-title');
    renderer.draw(cell);
    const clipWidth = (cell.ctx.rect as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[2] as number | undefined;
    // the 17-character title is 136px wide, so it is clipped; the clip ends before the arrow's area
    expect(clipWidth).toBeLessThanOrEqual(100 - 18 - 6);
  });
});

describe('HeaderRenderer selection', () => {
  const background = (renderer: HeaderRenderer, selected: CellContext['selected']) => {
    const cell = createCell('price', { selected });
    const fills: string[] = [];
    Object.defineProperty(cell.ctx, 'fillStyle', { set: (value: string) => fills.push(value), get: () => '' });
    renderer.draw(cell);
    return fills[0];
  };

  it('fills a header with the colour for how much of its column is selected', () => {
    const renderer = new HeaderRenderer({ background: '#111', selectedBackground: '#222', fullySelectedBackground: '#333' });
    expect(background(renderer, 'none')).toBe('#111');
    expect(background(renderer, 'partial')).toBe('#222');
    expect(background(renderer, 'full')).toBe('#333');
  });
});
