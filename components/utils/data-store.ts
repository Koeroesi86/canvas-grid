import ColumnStore from './column-store';
import RowStore from './row-store';
import { getNow } from './selectors';
import type { Row } from './row-store';
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

/** Fewer changed rows than this fraction of all rows are moved one by one; more are cheaper to sort together. */
const INCREMENTAL_SORT_RATIO = 8;

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
 * Sort keys for the default ordering of a column, computed once so comparing two rows is two array reads:
 * a type rank, and within it a number (the value, or the position of its text among all the column's texts).
 */
const createDefaultKey = (values: readonly unknown[]) => {
  const ranks = new Uint8Array(values.length);
  const keys = new Float64Array(values.length);
  // every distinct text gets an id on the way, so ranks can be looked up by index instead of by text again
  const textIds = new Int32Array(values.length);
  const ids = new Map<string, number>();
  for (let slot = 0; slot < values.length; slot++) {
    const value = values[slot];
    const rank = typeRank(value);
    ranks[slot] = rank;
    if (rank === 0) {
      keys[slot] = Number(value);
      continue;
    }
    if (rank !== 1 && rank !== 2) continue;

    const text = String(value);
    let id = ids.get(text);
    if (id === undefined) {
      id = ids.size;
      ids.set(text, id);
    }
    textIds[slot] = id;
  }

  // equal texts (as the collator sees them) share a position, so they tie and fall through to the next key
  const positions = new Float64Array(ids.size);
  const sorted = Array.from(ids.keys()).sort(collator.compare);
  let position = 0;
  sorted.forEach((text, index) => {
    if (index > 0 && collator.compare(sorted[index - 1], text) !== 0) position++;
    positions[ids.get(text) ?? 0] = position;
  });
  for (let slot = 0; slot < values.length; slot++) {
    if (ranks[slot] === 1 || ranks[slot] === 2) keys[slot] = positions[textIds[slot]];
  }
  return { ranks, keys };
};

type DefaultKey = ReturnType<typeof createDefaultKey>;

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
  /** Ids of the rows changed since the last sort; only those have to move when few changed. */
  private sortChanged = new Set<string>();
  /** Sort keys per column, reused until the column's values change (e.g. when only the direction flips). */
  private defaultKeys = new WeakMap<ColumnStore, { version: number; key: DefaultKey }>();

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
    this.sortChanged.clear();
    // size the columns of the first row up front instead of growing them one value at a time
    Object.keys(data[0] ?? {}).forEach(key => this.columns.set(key, new ColumnStore(data.length)));
    data.forEach((row, index) => this.addRow(this.environment.getRowId(row, index), row, undefined));
    // rows were added in insertion order, which is the order without a sort model
    if (this.sortModel.length > 0) this.sort();
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
    this.sortChanges();
    return true;
  }

  private column(key: string) {
    let column = this.columns.get(key);
    if (!column) {
      column = new ColumnStore(this.rows.slotCount);
      this.columns.set(key, column);
    }
    return column;
  }

  private addRow(id: RowId, row: RowInput, updatedAt: number | undefined) {
    const { slot } = this.rows.set({ id, height: this.environment.getCellHeight() });
    const keys = Object.keys(row);
    for (const key of keys) this.column(key).set(slot, row[key], updatedAt);
    this.markSortDirty(id, keys);
  }

  private removeRows(ids: Key[]) {
    if (ids.length === 0) return false;

    const slots = this.rows.removeMany(ids);
    this.columns.forEach(column => column.clearSlots(slots));
    const kept = this.rows.compactSlots();
    if (kept) this.columns.forEach(column => column.compact(kept));
    return slots.length > 0;
  }

  private applyUpdate(row: RowInput, now: number) {
    const rowId = this.environment.getRowId(row);
    const rowData = this.rows.get(rowId);
    if (!rowData) {
      this.addRow(rowId, row, now);
      return;
    }
    Object.keys(row).forEach(key => this.applyValue(rowData.id, rowData.slot, key, row[key], now));
  }

  private applyValue(rowId: RowId, slot: number, key: string, value: unknown, now: number) {
    const column = this.column(key);
    const previous = column.get(slot);
    if (previous === value) return;
    // a value appearing in a column the row did not have yet is not an update worth flashing
    column.set(slot, value, previous === undefined ? undefined : now);
    this.markSortDirty(rowId, [key]);
  }

  private markSortDirty(rowId: RowId, keys: string[]) {
    if (!this.sortModel.some(({ columnId }) => keys.includes(String(columnId)))) return;
    this.sortDirty = true;
    this.sortChanged.add(String(rowId));
  }

  private defaultKeyOf(column: ColumnStore) {
    const cached = this.defaultKeys.get(column);
    if (cached && cached.version === column.version) return cached.key;

    const key = createDefaultKey(column.values);
    this.defaultKeys.set(column, { version: column.version, key });
    return key;
  }

  /** Orders two rows by the sort model, ties by slot so the order is total. */
  private createComparator(precompute: boolean) {
    const [only, ...rest] = this.sortModel;
    const onlyColumn = only && !only.compare && precompute && rest.length === 0 ? this.columns.get(String(only.columnId)) : undefined;
    if (onlyColumn) {
      // the common case, a single default-ordered column, without the per-key loop and calls
      const { ranks, keys } = this.defaultKeyOf(onlyColumn);
      const sign = only.direction === 'desc' ? -1 : 1;
      return (a: Row, b: Row) => {
        const order = ranks[a.slot] - ranks[b.slot] || keys[a.slot] - keys[b.slot] || 0;
        return order === 0 ? a.slot - b.slot : order * sign;
      };
    }

    const keys = this.sortModel.map(({ columnId, direction = 'asc', compare }) => {
      const column = this.columns.get(String(columnId));
      const values = column?.values;
      const sign = direction === 'desc' ? -1 : 1;
      if (!column || !values) return { order: () => 0, sign };
      if (compare) return { order: (a: Row, b: Row) => compare(values[a.slot], values[b.slot]), sign };
      if (!precompute) return { order: (a: Row, b: Row) => compareValues(values[a.slot], values[b.slot]), sign };

      const { ranks, keys: sortKeys } = this.defaultKeyOf(column);
      return {
        order: (a: Row, b: Row) => ranks[a.slot] - ranks[b.slot] || sortKeys[a.slot] - sortKeys[b.slot] || 0,
        sign,
      };
    });

    return (a: Row, b: Row) => {
      for (const { order, sign } of keys) {
        const result = order(a, b);
        if (result !== 0) return result * sign;
      }
      return a.slot - b.slot;
    };
  }

  private sort() {
    this.sortDirty = false;
    this.sortChanged.clear();
    this.rows.sort(this.createComparator(true));
  }

  /** Re-sorts after a flush: moves only the changed rows when they are few, otherwise sorts everything. */
  private sortChanges() {
    const changed = this.sortChanged;
    if (changed.size * INCREMENTAL_SORT_RATIO >= this.rows.length) {
      this.sort();
      return;
    }

    this.sortDirty = false;
    this.sortChanged = new Set();
    this.rows.resort(changed, this.createComparator(false));
  }
}

export default DataStore;
