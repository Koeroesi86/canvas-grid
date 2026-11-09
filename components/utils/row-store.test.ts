import { beforeEach, describe, expect, it } from 'vitest';
import RowStore from './row-store';

const row = (id: number | string, height = 20) => ({ id, height });

describe('RowStore', () => {
  let store: RowStore;

  beforeEach(() => {
    store = new RowStore();
    [0, 1, 2, 3, 4].forEach(id => store.set(row(id)));
  });

  it('keeps rows in insertion order with their position, offset and total height', () => {
    expect(store.keys).toEqual([0, 1, 2, 3, 4]);
    expect(store.get(3)?.index).toBe(3);
    expect(store.topOf(3)).toBe(60);
    expect(store.totalHeight).toBe(100);
  });

  it('treats 1 and "1" as the same id and replaces a row in place', () => {
    store.set(row('1', 50));
    expect(store.length).toBe(5);
    expect(store.keys[1]).toBe('1');
    expect(store.topOf(2)).toBe(70);
    expect(store.totalHeight).toBe(130);
  });

  describe('indexAt', () => {
    it('finds the first row ending below the offset', () => {
      expect(store.indexAt(-30)).toBe(0);
      expect(store.indexAt(0)).toBe(0);
      expect(store.indexAt(19)).toBe(0);
      expect(store.indexAt(20)).toBe(1);
      expect(store.indexAt(59)).toBe(2);
      expect(store.indexAt(99)).toBe(4);
      expect(store.indexAt(100)).toBe(5);
    });

    it('handles variable heights', () => {
      const variable = new RowStore();
      [10, 40, 5, 25].forEach((height, id) => variable.set(row(id, height)));
      expect(variable.indexAt(9)).toBe(0);
      expect(variable.indexAt(10)).toBe(1);
      expect(variable.indexAt(49)).toBe(1);
      expect(variable.indexAt(50)).toBe(2);
      expect(variable.indexAt(55)).toBe(3);
    });

    it('is empty-safe', () => {
      expect(new RowStore().indexAt(10)).toBe(0);
    });
  });

  describe('removeMany', () => {
    it('removes rows, renumbers the positions after them and returns the removed slots', () => {
      expect(store.removeMany([3, 1])).toEqual([1, 3]);
      expect(store.keys).toEqual([0, 2, 4]);
      expect(store.get(2)?.index).toBe(1);
      expect(store.get(4)?.index).toBe(2);
      expect([0, 2, 4].map(id => store.get(id)?.slot)).toEqual([0, 2, 4]);
      expect(store.topOf(2)).toBe(40);
      expect(store.totalHeight).toBe(60);
      expect(store.get(1)).toBeUndefined();
    });

    it('ignores unknown ids', () => {
      expect(store.removeMany([99])).toEqual([]);
      expect(store.length).toBe(5);
    });

    it('allows the same id to be added again at the end', () => {
      store.removeMany([0]);
      store.set(row(0));
      expect(store.keys).toEqual([1, 2, 3, 4, 0]);
      expect(store.get(0)?.index).toBe(4);
    });
  });

  it('sorts without changing slots, and renumbers positions and offsets', () => {
    store.sort((a, b) => Number(b.id) - Number(a.id));
    expect(store.keys).toEqual([4, 3, 2, 1, 0]);
    expect(store.get(4)).toMatchObject({ index: 0, slot: 4 });
    expect(store.topOf(1)).toBe(20);
    expect(store.indexAt(25)).toBe(1);
  });

  it('removes rows from a sorted store without moving the slots of the others', () => {
    store.sort((a, b) => Number(b.id) - Number(a.id));
    expect(store.removeMany([2])).toEqual([2]);
    expect(store.keys).toEqual([4, 3, 1, 0]);
    expect([4, 3, 1, 0].map(id => store.get(id)?.slot)).toEqual([4, 3, 1, 0]);
  });

  it('removes runs of rows anywhere in the order', () => {
    const many = new RowStore();
    Array.from({ length: 20 }, (_, id) => id).forEach(id => many.set(row(id)));
    many.removeMany([0, 1, 5, 6, 7, 19, 12]);
    expect(many.keys).toEqual([2, 3, 4, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18]);
    many.keys.forEach((key, index) => {
      expect(many.get(key)?.index).toBe(index);
      expect(many.topOf(index)).toBe(index * 20);
    });
  });

  it('gives new rows fresh slots after removals, and closes the holes once they outnumber the rows', () => {
    const many = new RowStore();
    Array.from({ length: 3000 }, (_, id) => id).forEach(id => many.set(row(id)));
    many.removeMany(Array.from({ length: 1500 }, (_, id) => id));
    expect(many.compactSlots()).toBeUndefined();
    many.set(row('new'));
    expect(many.get('new')?.slot).toBe(3000);

    many.removeMany(Array.from({ length: 700 }, (_, id) => 1500 + id));
    const kept = many.compactSlots();
    expect(kept?.length).toBe(many.length);
    expect(kept?.[0]).toBe(2200);
    expect(many.slotCount).toBe(many.length);
    expect(many.keys.map(key => many.get(key)?.slot)).toEqual(many.keys.map((_, index) => index));
  });

  it('clears everything', () => {
    store.clear();
    expect(store.length).toBe(0);
    expect(store.totalHeight).toBe(0);
    expect(store.get(0)).toBeUndefined();
  });
});
