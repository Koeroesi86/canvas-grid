import { describe, expect, it, vi } from 'vitest';
import React, { Group, primitive } from './jsx';
import Rect from '../rectangle';

const createContext = () => {
  const fillRect = vi.fn();
  const ctx = { fillRect, fillStyle: '', globalAlpha: 1 };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fillRect, raw: ctx };
};

describe('React.createElement', () => {
  it('does not draw until draw is called', () => {
    const paint = vi.fn();
    const Leaf = primitive<{ size: number }>(paint);
    const node = React.createElement(Leaf, { size: 3 });
    expect(paint).not.toHaveBeenCalled();
    node.draw(createContext().ctx, 5, 6);
    expect(paint).toHaveBeenCalledWith(expect.anything(), { size: 3, children: [] }, 5, 6);
  });
});

describe('Group', () => {
  it('draws children relative to the origin and its own offset', () => {
    const { ctx, fillRect } = createContext();
    React.createElement(Group, { x: 10, y: 20 },
      React.createElement(Rect, { x: 1, y: 2, width: 3, height: 4, color: 'red' }),
    ).draw(ctx, 100, 200);
    expect(fillRect).toHaveBeenCalledWith(111, 222, 3, 4);
  });

  it('skips false, null and undefined children and flattens arrays', () => {
    const { ctx, fillRect } = createContext();
    const rect = (x: number) => React.createElement(Rect, { x, width: 1, height: 1, color: 'red' });
    React.createElement(Group, null, false, null, undefined, rect(1), [rect(2), false]).draw(ctx, 0, 0);
    expect(fillRect.mock.calls.map(([x]) => x)).toEqual([1, 2]);
  });

  it('nests', () => {
    const { ctx, fillRect } = createContext();
    React.createElement(Group, { x: 5 },
      React.createElement(Group, { x: 7 }, React.createElement(Rect, { width: 1, height: 1, color: 'red' })),
    ).draw(ctx, 1, 0);
    expect(fillRect).toHaveBeenCalledWith(13, 0, 1, 1);
  });
});

describe('Rect', () => {
  it('fills with the color and resets the alpha it applied', () => {
    const { ctx, fillRect, raw } = createContext();
    React.createElement(Rect, { width: 10, height: 5, color: 'blue', alpha: 0.5 }).draw(ctx, 0, 0);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 10, 5);
    expect(raw.fillStyle).toBe('blue');
    expect(raw.globalAlpha).toBe(1);
  });

  it.each([
    { width: 0, height: 5, color: 'red' },
    { width: 5, height: 0.5, color: 'red' },
    { width: 5, height: 5, color: '' },
    { width: 5, height: 5, color: 'red', alpha: 0 },
  ])('draws nothing for %o', props => {
    const { ctx, fillRect } = createContext();
    React.createElement(Rect, props).draw(ctx, 0, 0);
    expect(fillRect).not.toHaveBeenCalled();
  });
});
