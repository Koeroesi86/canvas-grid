import { describe, expect, it, vi } from 'vitest';
import Renderer from './renderer';

interface Options {
  color: string;
  size: number;
}

class TestRenderer extends Renderer<Options> {
  readonly updates: Options[] = [];

  constructor(options: Options) {
    super(options);
  }

  optionsUpdated(previous: Options) {
    this.updates.push(previous);
  }
}

describe('Renderer', () => {
  it('copies the options it is given', () => {
    const input = { color: 'red', size: 1 };
    const renderer = new TestRenderer(input);
    renderer.options.size = 5;
    expect(input.size).toBe(1);
  });

  it('update merges options and reports the previous ones', () => {
    const renderer = new TestRenderer({ color: 'red', size: 1 });
    renderer.update({ size: 2 });
    expect(renderer.options).toEqual({ color: 'red', size: 2 });
    expect(renderer.updates).toEqual([{ color: 'red', size: 1 }]);
  });

  it('assigning an option directly is a plain write without notification', () => {
    const renderer = new TestRenderer({ color: 'red', size: 1 });
    const spy = vi.spyOn(renderer, 'optionsUpdated');
    renderer.options.color = 'blue';
    expect(spy).not.toHaveBeenCalled();
  });
});
