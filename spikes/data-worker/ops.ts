import DataStore from '../../components/utils/data-store';
import type { RowInput } from '../../components/types';

export const createStore = () => new DataStore({ getRowId: row => row.id, getCellHeight: () => 20 });

/** Values unrelated to the insertion order, so sorting does real work. */
export const createRow = (id: number, count: number): RowInput => {
  const scrambled = (id * 7919) % count;
  return { id, name: `item ${scrambled}`, price: scrambled * 1.5, quantity: scrambled % 100, category: `cat ${scrambled % 50}` };
};

export const createRows = (count: number) => Array.from({ length: count }, (_, id) => createRow(id, count));

/** A feed message: `count` rows with a changed price. */
export const createChanges = (rowCount: number, count: number): RowInput[] => Array.from({ length: count }, () => ({
  id: (Math.random() * rowCount) | 0,
  price: Math.random() * 10000,
}));

export const loadRows = (store: ReturnType<typeof createStore>, rows: RowInput[]) => store.setRows(rows);

export const applyChanges = (store: ReturnType<typeof createStore>, changes: RowInput[]) => {
  changes.forEach(change => store.queueUpdate(change));
  store.flush();
};

export const sortBy = (store: ReturnType<typeof createStore>, columnId: string | undefined) => {
  store.setSortModel(columnId === undefined ? [] : [{ columnId }]);
  const order = new Uint32Array(store.rows.length);
  order.forEach((_, index) => { order[index] = store.rows.at(index)?.slot ?? 0; });
  return order;
};

/** The values a viewport needs: what the draw path reads each frame. */
export const readWindow = (store: ReturnType<typeof createStore>, from: number, to: number) => Array.from({ length: to - from }, (_, offset) => {
  const row = store.rows.at(from + offset);
  return row ? ['name', 'price', 'quantity', 'category'].map(column => store.columns.get(column)?.get(row.slot)) : [];
});
