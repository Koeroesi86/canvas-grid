import { beforeEach, describe, expect, it } from 'vitest';
import DataStore from './data-store';
import type { RowInput } from '../types';

const createStore = () => new DataStore({
  getRowId: row => row.id,
  getCellHeight: () => 20,
});


describe('DataStore', () => {
  let store: DataStore;

  beforeEach(() => {
    store = createStore();
  });

  describe('setRows', () => {
    it('stores rows by id with index and height, and the values by column', () => {
      store.setRows([{ id: 'a', name: 'x' }, { id: 'b', name: 'y' }]);
      expect(store.rows.keys).toEqual(['a', 'b']);
      expect(store.rows.get('b')).toMatchObject({ index: 1, slot: 1, height: 20 });
      expect(store.getValue('a', 'name')).toBe('x');
      expect(store.getValue('b', 'name')).toBe('y');
      expect(store.getUpdatedAt('a', 'name')).toBeUndefined();
    });

    it('keeps the values as they are, without formatting them', () => {
      store.setRows([{ id: 1, price: 2.5, flag: false }]);
      expect(store.getValue(1, 'price')).toBe(2.5);
      expect(store.getValue(1, 'flag')).toBe(false);
    });

    it('replaces previous rows and drops queued changes', () => {
      store.setRows([{ id: 'old' }]);
      store.queueUpdate({ id: 'queued' });
      store.queueRemove({ id: 'old' });
      store.setRows([{ id: 'new' }]);
      expect(store.rows.keys).toEqual(['new']);
      expect(store.hasPending).toBe(false);
    });
  });

  describe('queued transactions', () => {
    it('nothing changes until flushed', () => {
      store.queueUpdate({ id: 1, value: 'a' });
      expect(store.rows.length).toBe(0);
      expect(store.hasPending).toBe(true);
    });

    it('inserts unknown rows at the end with the update timestamp', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueUpdate({ id: 2, value: 'b' });
      store.flush(1000);
      expect(store.rows.get(2)?.index).toBe(1);
      expect(store.getUpdatedAt(2, 'value')).toBe(1000);
      expect(store.hasPending).toBe(false);
    });

    it('updates changed values and stamps updatedAt', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueUpdate({ id: 1, value: 'b' });
      store.flush(2000);
      expect(store.getValue(1, 'value')).toBe('b');
      expect(store.getUpdatedAt(1, 'value')).toBe(2000);
    });

    it('leaves unchanged values and their timestamp alone', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueUpdate({ id: 1, value: 'a' });
      store.flush(3000);
      expect(store.getUpdatedAt(1, 'value')).toBeUndefined();
    });

    it('adds columns that did not exist on the row', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueUpdate({ id: 1, extra: 'z' });
      store.flush(4000);
      expect(store.getValue(1, 'extra')).toBe('z');
      expect(store.getValue(1, 'value')).toBe('a');
      expect(store.getUpdatedAt(1, 'extra')).toBeUndefined();
    });

    it('applies several queued updates to the same row in order', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueUpdate({ id: 1, value: 'b' });
      store.queueUpdate({ id: 1, value: 'c' });
      store.flush();
      expect(store.getValue(1, 'value')).toBe('c');
    });

    it('removes rows and ignores unknown ids', () => {
      store.setRows([{ id: 1 }, { id: 2 }]);
      store.queueRemove({ id: 1 });
      store.queueRemove({ id: 99 });
      store.flush();
      expect(store.rows.keys).toEqual([2]);
      expect(store.hasPending).toBe(false);
    });

    it('applies a removal followed by a re-add in queue order', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueRemove({ id: 1 });
      store.queueUpdate({ id: 1, value: 'b' });
      store.flush();
      expect(store.getValue(1, 'value')).toBe('b');
    });

    it('keeps every row with its own values when rows in the middle are removed', () => {
      store.setRows([{ id: 1, v: 'a' }, { id: 2, v: 'b' }, { id: 3, v: 'c' }, { id: 4, v: 'd' }]);
      store.queueRemove({ id: 2 });
      store.queueRemove({ id: 3 });
      store.flush();
      expect(store.rows.keys).toEqual([1, 4]);
      expect(store.getValue(1, 'v')).toBe('a');
      expect(store.getValue(4, 'v')).toBe('d');
      expect(store.rows.get(4)).toMatchObject({ index: 1, slot: 3 });
    });

    it('keeps update times with their rows when rows are removed', () => {
      store.setRows([{ id: 1, v: 'a' }, { id: 2, v: 'b' }, { id: 3, v: 'c' }]);
      store.queueUpdate({ id: 3, v: 'C' });
      store.flush(500);
      store.queueRemove({ id: 1 });
      store.flush(600);
      expect(store.getUpdatedAt(3, 'v')).toBe(500);
      expect(store.getUpdatedAt(2, 'v')).toBeUndefined();
    });

    it('reports whether rows were removed', () => {
      store.setRows([{ id: 1 }, { id: 2 }]);
      store.queueUpdate({ id: 1, value: 'x' });
      expect(store.flush()).toBe(false);
      store.queueRemove({ id: 99 });
      expect(store.flush()).toBe(false);
      store.queueRemove({ id: 2 });
      expect(store.flush()).toBe(true);
    });

    it('renumbers the rows after a removal', () => {
      store.setRows([{ id: 1 }, { id: 2 }, { id: 3 }]);
      store.queueRemove({ id: 1 });
      store.flush();
      expect(store.rows.get(2)?.index).toBe(0);
      expect(store.rows.get(3)?.index).toBe(1);
      expect(store.rows.totalHeight).toBe(40);
    });

    it('removes a row updated earlier in the queue', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueUpdate({ id: 1, value: 'b' });
      store.queueRemove({ id: 1 });
      store.flush();
      expect(store.rows.length).toBe(0);
    });

    it('uses the configured row id getter', () => {
      const custom = new DataStore({
        getRowId: (row: RowInput) => String(row.key),
        getCellHeight: () => 10,
      });
      custom.setRows([{ id: 0, key: 'k1', v: 1 }]);
      custom.queueUpdate({ id: 0, key: 'k1', v: 2 });
      custom.flush();
      expect(custom.rows.keys).toEqual(['k1']);
      expect(custom.getValue('k1', 'v')).toBe(2);
    });
  });

  describe('sort model', () => {
    const rows = [
      { id: 1, name: 'pear', price: 3 },
      { id: 2, name: 'apple', price: 10 },
      { id: 3, name: 'fig', price: 2 },
      { id: 4, name: 'apple', price: 1 },
    ];

    beforeEach(() => {
      store.setRows(rows);
    });

    it('orders rows by a column and numbers them by position', () => {
      store.setSortModel([{ columnId: 'price' }]);
      expect(store.rows.keys).toEqual([4, 3, 1, 2]);
      expect(store.rows.get(4)?.index).toBe(0);
      expect(store.getValue(4, 'price')).toBe(1);
    });

    it('sorts descending, by several columns, and keeps ties in the original order', () => {
      store.setSortModel([{ columnId: 'name' }, { columnId: 'price', direction: 'desc' }]);
      expect(store.rows.keys).toEqual([2, 4, 3, 1]);
      store.setSortModel([{ columnId: 'name' }]);
      expect(store.rows.keys).toEqual([2, 4, 3, 1]);
    });

    it('restores the original order with an empty model', () => {
      store.setSortModel([{ columnId: 'price' }]);
      store.setSortModel([]);
      expect(store.rows.keys).toEqual([1, 2, 3, 4]);
    });

    it('uses a custom comparison', () => {
      store.setSortModel([{ columnId: 'name', compare: (a, b) => String(a).length - String(b).length }]);
      expect(store.rows.keys.slice(0, 2)).toEqual([3, 1]);
    });

    it('compares numbers numerically, then text, with empty values last', () => {
      const mixed = createStore();
      mixed.setRows([{ id: 1, v: 'b' }, { id: 2, v: 10 }, { id: 3 }, { id: 4, v: 9 }, { id: 5, v: 'a' }]);
      mixed.setSortModel([{ columnId: 'v' }]);
      expect(mixed.rows.keys).toEqual([4, 2, 5, 1, 3]);
    });

    it('re-sorts when an update changes the sorted column, and reports that rows moved', () => {
      store.setSortModel([{ columnId: 'price' }]);
      store.queueUpdate({ id: 4, price: 100 });
      expect(store.flush()).toBe(true);
      expect(store.rows.keys).toEqual([3, 1, 2, 4]);
    });

    it('places new rows in order and does not re-sort for unrelated updates', () => {
      store.setSortModel([{ columnId: 'price' }]);
      store.queueUpdate({ id: 5, name: 'kiwi', price: 5 });
      expect(store.flush()).toBe(true);
      expect(store.rows.keys).toEqual([4, 3, 1, 5, 2]);

      store.queueUpdate({ id: 1, name: 'plum' });
      expect(store.flush()).toBe(false);
    });

    it('keeps the sort when rows are replaced or removed', () => {
      store.setSortModel([{ columnId: 'price' }]);
      store.queueRemove({ id: 3 });
      store.flush();
      expect(store.rows.keys).toEqual([4, 1, 2]);
      store.setRows(rows);
      expect(store.rows.keys).toEqual([4, 3, 1, 2]);
    });
  });
  describe('re-sorting after updates', () => {
    /** Same data in a store that always re-sorts everything, to compare with. */
    const fullySorted = (rows: RowInput[], columnId: string, direction: 'asc' | 'desc') => {
      const reference = createStore();
      reference.setRows(rows);
      reference.setSortModel([{ columnId, direction }]);
      return reference.rows.keys;
    };

    const pseudoRandom = (seed: number) => () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    it.each(['asc', 'desc'] as const)('moves a few changed rows to where a full sort puts them (%s)', direction => {
      const random = pseudoRandom(7);
      const rows: RowInput[] = Array.from({ length: 200 }, (_, id) => ({ id, price: Math.floor(random() * 50), name: `n${Math.floor(random() * 30)}` }));
      store.setRows(rows);
      store.setSortModel([{ columnId: 'price', direction }]);

      for (let round = 0; round < 20; round++) {
        const changes = Array.from({ length: 1 + (round % 5) }, () => ({ id: Math.floor(random() * 200), price: Math.floor(random() * 50) }));
        changes.forEach(change => {
          rows[change.id] = { ...rows[change.id], ...change };
          store.queueUpdate(change);
        });
        store.flush();
        expect(store.rows.keys).toEqual(fullySorted(rows, 'price', direction));
        store.rows.keys.forEach((key, index) => expect(store.rows.get(key)?.index).toBe(index));
      }
    });

    it('places new rows and removals correctly among the sorted rows', () => {
      const rows: RowInput[] = Array.from({ length: 100 }, (_, id) => ({ id, price: (id * 37) % 101 }));
      store.setRows(rows);
      store.setSortModel([{ columnId: 'price' }]);

      store.queueUpdate({ id: 500, price: 50 });
      store.queueUpdate({ id: 501, price: -1 });
      store.queueRemove({ id: 3 });
      store.queueUpdate({ id: 4, price: 1000 });
      store.flush();

      const expected = [...rows.filter(row => row.id !== 3).map(row => (row.id === 4 ? { ...row, price: 1000 } : row)), { id: 500, price: 50 }, { id: 501, price: -1 }];
      expect(store.rows.keys).toEqual(fullySorted(expected, 'price', 'asc'));
    });

    it('keeps the order total when values are equal', () => {
      store.setRows(Array.from({ length: 80 }, (_, id) => ({ id, price: id % 2 })));
      store.setSortModel([{ columnId: 'price' }]);
      store.queueUpdate({ id: 10, price: 1 });
      store.flush();
      expect(store.rows.keys.filter(key => store.getValue(key, 'price') === 1)).toEqual([1, 3, 5, 7, 9, 10, 11, ...Array.from({ length: 34 }, (_, i) => 13 + (i * 2))]);
    });

    it('sorts everything when many rows changed', () => {
      const rows: RowInput[] = Array.from({ length: 40 }, (_, id) => ({ id, price: id }));
      store.setRows(rows);
      store.setSortModel([{ columnId: 'price' }]);
      rows.slice(0, 20).forEach(row => store.queueUpdate({ id: row.id, price: -row.id }));
      store.flush();
      expect(store.rows.keys.slice(0, 3)).toEqual([19, 18, 17]);
    });
  });

  describe('default ordering', () => {
    it('orders numbers, then text (by the collator), then other values, with empty values last', () => {
      store.setRows([
        { id: 'empty' },
        { id: 'b', value: 'b' },
        { id: 'ten', value: 10 },
        { id: 'a', value: 'a' },
        { id: 'two', value: 2 },
        { id: 'flag', value: true },
        { id: 'A', value: 'A' },
      ]);
      store.setSortModel([{ columnId: 'value' }]);
      expect(store.rows.keys).toEqual(['two', 'ten', 'a', 'A', 'b', 'flag', 'empty']);
    });
  });

  describe('removal at scale', () => {
    it('keeps every remaining value on the right row while slots are compacted', () => {
      const total = 6000;
      store.setRows(Array.from({ length: total }, (_, id) => ({ id, a: id * 2, b: `b${id}` })));
      store.setSortModel([{ columnId: 'a', direction: 'desc' }]);
      store.queueUpdate({ id: 5999, a: -1 });
      store.flush();

      // drop the oldest rows in batches, adding new ones, across several compactions
      for (let batch = 0; batch < 6; batch++) {
        const first = batch * 900;
        Array.from({ length: 900 }, (_, offset) => store.queueRemove({ id: first + offset }));
        Array.from({ length: 100 }, (_, offset) => store.queueUpdate({ id: total + batch * 100 + offset, a: 1, b: 'new' }));
        store.flush();
      }

      const survivors = store.rows.keys;
      expect(survivors.length).toBe(total - 5400 + 600);
      survivors.forEach(id => {
        const numeric = Number(id);
        expect(store.getValue(id, 'a')).toBe(numeric >= total ? 1 : numeric === 5999 ? -1 : numeric * 2);
        expect(store.getValue(id, 'b')).toBe(numeric >= total ? 'new' : `b${numeric}`);
      });
      const sorted = survivors.map(id => Number(store.getValue(id, 'a')));
      expect(sorted).toEqual(sorted.slice().sort((x, y) => y - x));
    });
  });
});
