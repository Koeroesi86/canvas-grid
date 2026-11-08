import ColumnStore from './column-store';
import RowStore from './row-store';
import { getNow } from './selectors';
import type { Key, RowId, RowInput, SortKey } from '../types';

export type RowIdGetter = (row: RowInput, index?: number) => RowId;

export interface DataStoreEnvironment {
  getRowId: RowIdGetter;
  getCellHeight: () => number;
}

interface PendingChange {
  type: 'update' | 'remove';
  row: RowInput;
}

const collator = new Intl.Collator();

const typeRank = (value: unknown) => {
  if (value === undefined || value === null) return 3;
  if (typeof value === 'number' || typeof value === 'bigint') return 0;
  return typeof value === 'string' ? 1 : 2;
};

/** Numbers numerically, then text, then anything else as text; empty values sort last. */
export const compareValues = (a: unknown, b: unknown) => {
  const rank = typeRank(a) - typeRank(b);
  if (rank !== 0) return rank;
  if (typeRank(a) === 3) return 0;
  if (typeRank(a) === 0) return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
};

/**
 * Cell values stored by column (one array per column, addressed by the row's slot) plus the row order,
 * with the queued add/update/remove handling and the sort model. Independent of the DOM.
 */
class DataStore {
  rows = new RowStore();
  columns = new Map<string, ColumnStore>();

  /** Queued changes, applied in the order they were made. */
  private pending: PendingChange[] = [];
  private sortModel: readonly SortKey[] = [];
  private sortDirty = false;

  private environment: DataStoreEnvironment;

  constructor(environment: DataStoreEnvironment) {
    this.environment = environment;
  }

  get hasPending() {
    return this.pending.length > 0;
  }

  getSortModel() {
    return this.sortModel;
  }

  /** Orders the rows by the given columns, in priority order; an empty model restores the insertion order. */
  setSortModel(model: readonly SortKey[]) {
    this.sortModel = [...model];
    this.sort();
  }

  /** Value of a cell, `undefined` when the row has none. */
  getValue(rowId: RowId, columnKey: Key) {
    const row = this.rows.get(rowId);
    return row ? this.columns.get(String(columnKey))?.get(row.slot) : undefined;
  }

  getUpdatedAt(rowId: RowId, columnKey: Key) {
    const row = this.rows.get(rowId);
    return row ? this.columns.get(String(columnKey))?.getUpdatedAt(row.slot) : undefined;
  }

  queueUpdate(row: RowInput) {
    this.pending.push({ type: 'update', row });
  }

  queueRemove(row: RowInput) {
    this.pending.push({ type: 'remove', row });
  }

  clear() {
    this.rows.clear();
    this.columns.clear();
  }

  /** Replaces everything, dropping any queued changes. */
  setRows(data: RowInput[]) {
    this.pending = [];
    this.clear();
    data.forEach((row, index) => this.addRow(this.environment.getRowId(row, index), row, undefined));
    this.sort();
  }

  /**
   * Applies the queued changes in the order they were queued; consecutive removals are applied together.
   * Returns whether rows changed position (removed or re-sorted), which needs the whole grid to be redrawn.
   */
  flush(now = getNow()) {
    const changes = this.pending;
    this.pending = [];
    const removals: Key[] = [];
    let moved = false;
    const applyRemovals = () => {
      moved = this.removeRows(removals) || moved;
      removals.length = 0;
    };

    changes.forEach(({ type, row }) => {
      if (type === 'remove') {
        removals.push(this.environment.getRowId(row));
        return;
      }
      applyRemovals();
      this.applyUpdate(row, now);
    });
    applyRemovals();

    if (!this.sortDirty) return moved;
    this.sort();
    return true;
  }

  private column(key: string) {
    let column = this.columns.get(key);
    if (!column) {
      column = new ColumnStore(this.rows.length);
      this.columns.set(key, column);
    }
    return column;
  }

  private addRow(id: RowId, row: RowInput, updatedAt: number | undefined) {
    this.rows.set({ id, height: this.environment.getCellHeight() });
    const slot = this.rows.get(id)?.slot ?? 0;
    Object.keys(row).forEach(key => this.column(key).set(slot, row[key], updatedAt));
    this.markSortDirty(Object.keys(row));
  }

  private removeRows(ids: Key[]) {
    if (ids.length === 0) return false;

    const slots = this.rows.removeMany(ids);
    this.columns.forEach(column => column.removeSlots(slots));
    return slots.length > 0;
  }

  private applyUpdate(row: RowInput, now: number) {
    const rowId = this.environment.getRowId(row);
    const rowData = this.rows.get(rowId);
    if (!rowData) {
      this.addRow(rowId, row, now);
      return;
    }
    Object.keys(row).forEach(key => this.applyValue(rowData.slot, key, row[key], now));
  }

  private applyValue(slot: number, key: string, value: unknown, now: number) {
    const column = this.column(key);
    const previous = column.get(slot);
    if (previous === value) return;
    // a value appearing in a column the row did not have yet is not an update worth flashing
    column.set(slot, value, previous === undefined ? undefined : now);
    this.markSortDirty([key]);
  }

  private markSortDirty(keys: string[]) {
    if (this.sortModel.some(({ columnId }) => keys.includes(String(columnId)))) this.sortDirty = true;
  }

  private sort() {
    this.sortDirty = false;
    const keys = this.sortModel.map(({ columnId, direction = 'asc', compare = compareValues }) => ({
      values: this.columns.get(String(columnId))?.values,
      compare,
      sign: direction === 'desc' ? -1 : 1,
    }));

    this.rows.sort((a, b) => {
      for (const { values, compare, sign } of keys) {
        const order = values ? compare(values[a.slot], values[b.slot]) : 0;
        if (order !== 0) return order * sign;
      }
      return a.slot - b.slot;
    });
  }
}

export default DataStore;
