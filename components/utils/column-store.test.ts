import { describe, expect, it } from 'vitest';
import ColumnStore from './column-store';

describe('ColumnStore', () => {
  it('stores values by slot, padding gaps with undefined', () => {
    const column = new ColumnStore();
    column.set(2, 'c');
    expect(column.values).toEqual([undefined, undefined, 'c']);
    expect(column.get(5)).toBeUndefined();
  });

  it('starts with empty values for the existing rows', () => {
    expect(new ColumnStore(3).values).toEqual([undefined, undefined, undefined]);
  });

  it('only tracks update times once one is recorded', () => {
    const column = new ColumnStore();
    column.set(0, 'a');
    expect(column.getUpdatedAt(0)).toBeUndefined();
    column.set(1, 'b', 500);
    expect(column.getUpdatedAt(1)).toBe(500);
    expect(column.getUpdatedAt(0)).toBeUndefined();
  });

  it('empties slots without moving the others, including their update times', () => {
    const column = new ColumnStore();
    ['a', 'b', 'c', 'd'].forEach((value, slot) => column.set(slot, value, slot === 3 ? 700 : slot === 2 ? 600 : undefined));
    column.clearSlots([0, 2]);
    expect(column.values).toEqual([undefined, 'b', undefined, 'd']);
    expect(column.getUpdatedAt(2)).toBeUndefined();
    expect(column.getUpdatedAt(3)).toBe(700);
  });

  it('compacts to the given slots, keeping update times with their values', () => {
    const column = new ColumnStore();
    ['a', 'b', 'c', 'd'].forEach((value, slot) => column.set(slot, value, slot === 3 ? 700 : undefined));
    column.compact([1, 3]);
    expect(column.values).toEqual(['b', 'd']);
    expect(column.getUpdatedAt(1)).toBe(700);
    expect(column.getUpdatedAt(0)).toBeUndefined();
  });
});
