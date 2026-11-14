import { describe, expect, it, vi } from 'vitest';
import CellBackground from '.';
import type { CellContext } from '../types';

const createCell = (overrides: Partial<CellContext> = {}) => {
  const fillRect = vi.fn();
  const alphas: number[] = [];
  const fills: string[] = [];
  const ctx = {
    fillRect: (...args: number[]) => {
      fillRect(...args);
      alphas.push(ctx.globalAlpha);
      fills.push(ctx.fillStyle);
    },
    fillStyle: '',
    globalAlpha: 1,
  };
  const cell: CellContext = {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    x: 10,
    y: 20,
    width: 100,
    height: 30,
    row: undefined,
    column: undefined,
    value: undefined,
    formatted: '',
    updatedAt: undefined,
    age: Infinity,
    now: 0,
    dt: 0,
    valueChanged: false,
    forced: false,
    isScrolling: false,
    state: {},
    ...overrides,
  };
  return { cell, fillRect, alphas, fills };
};

describe('CellBackground', () => {
  const renderer = new CellBackground({ flashInDuration: 200, flashOutDuration: 400 });

  describe('isAnimating', () => {
    it.each([
      [0, true],
      [599, true],
      [600, true],
      [601, false],
      [Infinity, false],
    ])('age %d -> %s', (age, expected) => {
      expect(renderer.isAnimating(createCell({ age }).cell)).toBe(expected);
    });

    it('never animates with flashing disabled', () => {
      const still = new CellBackground({ enableFlashing: false });
      expect(still.isAnimating(createCell({ age: 0 }).cell)).toBe(false);
    });
  });

  describe('draw', () => {
    it('paints only the background when the cell is not flashing', () => {
      const { cell, fillRect } = createCell();
      renderer.draw(cell);
      expect(fillRect).toHaveBeenCalledTimes(1);
      expect(fillRect).toHaveBeenCalledWith(10, 20, 100, 30);
    });

    it('fades the flash in and out with the cell age', () => {
      const opacityAt = (age: number) => {
        const { cell, alphas } = createCell({ age });
        renderer.draw(cell);
        return alphas[1] ?? 0;
      };
      expect(opacityAt(100)).toBeCloseTo(0.5);
      expect(opacityAt(200)).toBeCloseTo(1);
      expect(opacityAt(400)).toBeCloseTo(0.25);
      expect(opacityAt(600)).toBeCloseTo(0);
    });

    it('eases the flash out faster at first than at the end', () => {
      const opacityAt = (age: number) => {
        const { cell, alphas } = createCell({ age });
        renderer.draw(cell);
        return alphas[1] ?? 0;
      };
      expect(opacityAt(300) - opacityAt(400)).toBeGreaterThan(opacityAt(500) - opacityAt(600));
    });

    it('lightens odd rows only', () => {
      const zebraAt = (index: number) => {
        const { cell, alphas } = createCell({ row: { id: index, index } });
        renderer.draw(cell);
        return alphas.length;
      };
      expect(zebraAt(0)).toBe(1);
      expect(zebraAt(1)).toBe(2);
    });

    it('keeps flashing while scrolling', () => {
      const { cell, fillRect, alphas } = createCell({ age: 100, isScrolling: true });
      renderer.draw(cell);
      expect(fillRect).toHaveBeenCalledTimes(2);
      expect(alphas[1]).toBeCloseTo(0.5);
    });

    it('draws the configured borders inside the cell', () => {
      const bordered = new CellBackground({ borderRightWidth: 1, borderRightColor: 'a', borderBottomWidth: 2, borderBottomColor: 'b' });
      const { cell, fillRect, fills } = createCell();
      bordered.draw(cell);
      expect(fillRect).toHaveBeenCalledWith(10 + 99, 20, 1, 30);
      expect(fillRect).toHaveBeenCalledWith(10, 20 + 28, 100, 2);
      expect(fills).toContain('a');
      expect(fills).toContain('b');
    });

    it('reads options changed through update', () => {
      const changing = new CellBackground();
      changing.update({ background: 'green' });
      const { cell, fills } = createCell();
      changing.draw(cell);
      expect(fills[0]).toBe('green');
    });
  });
});
