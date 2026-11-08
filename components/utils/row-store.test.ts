import { beforeEach, describe, expect, it } from 'vitest';
import Collection from './collection';
import RowStore from './row-store';
import type { ColumnData } from '../types';

const row = (id: number | string, height = 20) => ({ id, height, columns: new Collection<ColumnData>() });

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
    it('removes rows and renumbers the ones after them', () => {
      store.removeMany([1, 3]);
      expect(store.keys).toEqual([0, 2, 4]);
      expect(store.get(2)?.index).toBe(1);
      expect(store.get(4)?.index).toBe(2);
      expect(store.topOf(2)).toBe(40);
      expect(store.totalHeight).toBe(60);
      expect(store.get(1)).toBeUndefined();
    });

    it('ignores unknown ids', () => {
      store.removeMany([99]);
      expect(store.length).toBe(5);
    });

    it('allows the same id to be added again at the end', () => {
      store.removeMany([0]);
      store.set(row(0));
      expect(store.keys).toEqual([1, 2, 3, 4, 0]);
      expect(store.get(0)?.index).toBe(4);
    });
  });

  it('clears everything', () => {
    store.clear();
    expect(store.length).toBe(0);
    expect(store.totalHeight).toBe(0);
    expect(store.get(0)).toBeUndefined();
  });
});
