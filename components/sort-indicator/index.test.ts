import { describe, expect, it, vi } from 'vitest';
import SortIndicator, { SORT_INDICATOR_AREA } from '.';

const createContext = () => ({
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  fillStyle: '',
  globalAlpha: 1,
});

const draw = (direction: 'asc' | 'desc') => {
  const ctx = createContext();
  SortIndicator({ width: 100, height: 30, direction, color: '#fff' }).draw(ctx as never, 10, 20);
  return ctx;
};

describe('SortIndicator', () => {
  it('points up for ascending: the tip is above the base', () => {
    const ctx = draw('asc');
    const base = ctx.moveTo.mock.calls[0][1];
    const tip = ctx.lineTo.mock.calls[1][1];
    expect(tip).toBeLessThan(base);
  });

  it('points down for descending: the tip is below the base', () => {
    const ctx = draw('desc');
    const base = ctx.moveTo.mock.calls[0][1];
    const tip = ctx.lineTo.mock.calls[1][1];
    expect(tip).toBeGreaterThan(base);
  });

  it('sits in the reserved area at the right end, on whole pixels, vertically centred', () => {
    const ctx = draw('asc');
    const xs = [ctx.moveTo.mock.calls[0][0], ...ctx.lineTo.mock.calls.map(([x]) => x)];
    const ys = [ctx.moveTo.mock.calls[0][1], ...ctx.lineTo.mock.calls.map(([, y]) => y)];
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(10 + 100 - SORT_INDICATOR_AREA);
    expect(Math.max(...xs)).toBeLessThanOrEqual(10 + 100);
    expect(Math.abs(Math.min(...ys) + Math.max(...ys) - (2 * 20 + 30))).toBeLessThanOrEqual(1);
    expect(ys.every(Number.isInteger)).toBe(true);
  });

  it('fills with the given colour and restores the opacity', () => {
    const ctx = draw('asc');
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.fillStyle).toBe('#fff');
    expect(ctx.globalAlpha).toBe(1);
  });
});
