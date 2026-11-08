import Collection from './collection';
import { generateColumn, getColumn, getNow } from './selectors';
import type { ColumnData, Key, RowData, RowId, RowInput } from '../types';

export type Row = RowData<Collection<ColumnData>>;

export type RowIdGetter = (row: RowInput, index?: number) => RowId;

export interface DataStoreEnvironment {
  getRowId: RowIdGetter;
  formatValue: (key: Key, value: unknown) => string;
  getCellHeight: () => number;
}

/** Row storage plus the queued add/update/remove handling, independent of the DOM. */
class DataStore {
  rows = new Collection<Row>();
  pendingUpdates = new Collection<RowInput>();
  pendingRemoves = new Collection<RowInput>();

  private environment: DataStoreEnvironment;

  constructor(environment: DataStoreEnvironment) {
    this.environment = environment;
  }

  get hasPending() {
    return this.pendingUpdates.length > 0 || this.pendingRemoves.length > 0;
  }

  private createColumns(row: RowInput, updatedAt: number | undefined) {
    const columns = new Collection<ColumnData>();
    Object.keys(row).forEach(key => {
      columns.set(key, generateColumn(row[key], key, updatedAt, this.environment.formatValue(key, row[key])));
    });
    return columns;
  }

  queueUpdate(row: RowInput) {
    this.pendingUpdates.add(row);
  }

  queueRemove(row: RowInput) {
    this.pendingRemoves.add(row);
  }

  clear() {
    this.rows.clear();
  }

  /** Replaces everything, dropping any queued changes. */
  setRows(data: RowInput[]) {
    this.pendingUpdates.clear();
    this.pendingRemoves.clear();
    this.rows.clear();
    data.forEach((row, index) => {
      this.rows.set(this.environment.getRowId(row, index), {
        index,
        height: this.environment.getCellHeight(),
        columns: this.createColumns(row, undefined),
      });
    });
  }

  applyUpdates(now = getNow()) {
    this.pendingUpdates.forEach(row => this.applyUpdate(row, now));
    this.pendingUpdates.clear();
  }

  applyRemovals() {
    this.pendingRemoves.forEach(row => this.rows.delete(this.environment.getRowId(row)));
    this.pendingRemoves.clear();
  }

  /** Applies queued updates, then removals. */
  flush(now = getNow()) {
    if (this.pendingUpdates.length > 0) this.applyUpdates(now);
    if (this.pendingRemoves.length > 0) this.applyRemovals();
  }

  private applyUpdate(row: RowInput, now: number) {
    const rowId = this.environment.getRowId(row);
    const rowData = this.rows.get(rowId);
    if (!rowData) {
      const currentIndex = this.rows.keys.indexOf(rowId);
      this.rows.set(rowId, {
        index: currentIndex !== -1 ? currentIndex : this.rows.keys.length,
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
