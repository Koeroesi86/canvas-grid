import { beforeEach, describe, expect, it } from 'vitest';
import DataStore from './data-store';
import type { RowInput } from '../types';

const createStore = () => new DataStore({
  getRowId: row => row.id,
  formatValue: (_key, value) => `<${String(value)}>`,
  getCellHeight: () => 20,
});

const cellValue = (store: DataStore, rowId: string | number, column: string) => store.rows.get(rowId)?.columns.get(column);

describe('DataStore', () => {
  let store: DataStore;

  beforeEach(() => {
    store = createStore();
  });

  describe('setRows', () => {
    it('stores rows by id with index, height and formatted columns', () => {
      store.setRows([{ id: 'a', name: 'x' }, { id: 'b', name: 'y' }]);
      expect(store.rows.keys).toEqual(['a', 'b']);
      expect(store.rows.get('b')).toMatchObject({ index: 1, height: 20 });
      expect(cellValue(store, 'a', 'name')).toEqual({ column: 'name', value: 'x', displayedValue: '<x>', updatedAt: undefined });
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
      expect(cellValue(store, 2, 'value')?.updatedAt).toBe(1000);
      expect(store.hasPending).toBe(false);
    });

    it('updates changed values, reformats and stamps updatedAt', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueUpdate({ id: 1, value: 'b' });
      store.flush(2000);
      expect(cellValue(store, 1, 'value')).toMatchObject({ value: 'b', displayedValue: '<b>', updatedAt: 2000 });
    });

    it('leaves unchanged values and their timestamp alone', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueUpdate({ id: 1, value: 'a' });
      store.flush(3000);
      expect(cellValue(store, 1, 'value')?.updatedAt).toBeUndefined();
    });

    it('adds columns that did not exist on the row', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueUpdate({ id: 1, extra: 'z' });
      store.flush(4000);
      expect(cellValue(store, 1, 'extra')).toMatchObject({ value: 'z', displayedValue: '<z>' });
      expect(cellValue(store, 1, 'value')?.value).toBe('a');
    });

    it('applies several queued updates to the same row in order', () => {
      store.setRows([{ id: 1, value: 'a' }]);
      store.queueUpdate({ id: 1, value: 'b' });
      store.queueUpdate({ id: 1, value: 'c' });
      store.flush();
      expect(cellValue(store, 1, 'value')?.value).toBe('c');
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
      expect(cellValue(store, 1, 'value')?.value).toBe('b');
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
        formatValue: (_key, value) => String(value),
        getCellHeight: () => 10,
      });
      custom.setRows([{ id: 0, key: 'k1', v: 1 }]);
      custom.queueUpdate({ id: 0, key: 'k1', v: 2 });
      custom.flush();
      expect(custom.rows.keys).toEqual(['k1']);
      expect(custom.rows.get('k1')?.columns.get('v')?.value).toBe(2);
    });
  });
});
