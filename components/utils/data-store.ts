import Collection from './collection';
import RowStore, { type Row } from './row-store';
import { generateColumn, getColumn, getNow } from './selectors';
import type { ColumnData, Key, RowId, RowInput } from '../types';

export type RowIdGetter = (row: RowInput, index?: number) => RowId;

export interface DataStoreEnvironment {
  getRowId: RowIdGetter;
  formatValue: (key: Key, value: unknown) => string;
  getCellHeight: () => number;
}

interface PendingChange {
  type: 'update' | 'remove';
  row: RowInput;
}

/** Row storage plus the queued add/update/remove handling, independent of the DOM. */
class DataStore {
  rows = new RowStore();
  /** Queued changes, applied in the order they were made. */
  private pending: PendingChange[] = [];

  private environment: DataStoreEnvironment;

  constructor(environment: DataStoreEnvironment) {
    this.environment = environment;
  }

  get hasPending() {
    return this.pending.length > 0;
  }

  private createColumns(row: RowInput, updatedAt: number | undefined) {
    const columns = new Collection<ColumnData>();
    Object.keys(row).forEach(key => {
      columns.set(key, generateColumn(row[key], key, updatedAt, this.environment.formatValue(key, row[key])));
    });
    return columns;
  }

  queueUpdate(row: RowInput) {
    this.pending.push({ type: 'update', row });
  }

  queueRemove(row: RowInput) {
    this.pending.push({ type: 'remove', row });
  }

  clear() {
    this.rows.clear();
  }

  /** Replaces everything, dropping any queued changes. */
  setRows(data: RowInput[]) {
    this.pending = [];
    this.rows.clear();
    data.forEach((row, index) => {
      this.rows.set({
        id: this.environment.getRowId(row, index),
        height: this.environment.getCellHeight(),
        columns: this.createColumns(row, undefined),
      });
    });
  }

  /**
   * Applies the queued changes in the order they were queued; consecutive removals are applied together.
   * Returns whether rows were removed, which moves the rows after them.
   */
  flush(now = getNow()) {
    const changes = this.pending;
    this.pending = [];
    const removals: Key[] = [];
    let removed = false;
    const applyRemovals = () => {
      removed = this.rows.removeMany(removals) || removed;
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
    return removed;
  }

  private applyUpdate(row: RowInput, now: number) {
    const rowId = this.environment.getRowId(row);
    const rowData = this.rows.get(rowId);
    if (!rowData) {
      this.rows.set({
        id: rowId,
        height: this.environment.getCellHeight(),
        columns: this.createColumns(row, now),
      });
      return;
    }
    Object.keys(row).forEach(columnKey => this.applyColumn(rowData, columnKey, row[columnKey], now));
  }

  private applyColumn(rowData: Row, columnKey: string, value: unknown, now: number) {
    const columnData = getColumn(rowData, columnKey);
    if (!columnData) {
      rowData.columns.set(columnKey, generateColumn(value, columnKey, undefined, this.environment.formatValue(columnKey, value)));
      return;
    }
    if (columnData.value === value) return;
    columnData.value = value;
    columnData.displayedValue = this.environment.formatValue(columnKey, value);
    columnData.updatedAt = now;
  }
}

export default DataStore;
