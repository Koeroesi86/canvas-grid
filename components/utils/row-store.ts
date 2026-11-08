import type { Key, RowData, RowId } from '../types';

export type Row = RowData;

/**
 * Rows in display order: a dense array with an id lookup and each row's top offset,
 * so appends, lookups and finding the row at a scroll offset never scan every row.
 * Removing rows renumbers the rows after the first removed one (once per call).
 * Rows keep a `slot` into the column stores that does not change when the rows are sorted.
 */
class RowStore {
  private items: Row[] = [];

  private readonly indexById = new Map<string, number>();

  /** `tops[i]` is the offset of row `i` from the top of the first row. */
  private tops: number[] = [];

  private end = 0;

  get length() {
    return this.items.length;
  }

  /** Sum of all row heights. */
  get totalHeight() {
    return this.end;
  }

  get keys(): RowId[] {
    return this.items.map(row => row.id);
  }

  get(id: Key): Row | undefined {
    const index = this.indexById.get(String(id));
    return index === undefined ? undefined : this.items[index];
  }

  at(index: number): Row | undefined {
    return this.items[index];
  }

  topOf(index: number) {
    return this.tops[index] ?? this.end;
  }

  /** Index of the first row that ends below `offset`; `length` when the offset is past the last row. */
  indexAt(offset: number) {
    if (offset <= 0) return 0;
    if (offset >= this.end) return this.length;

    let low = 0;
    let high = this.items.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.tops[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return low;
  }

  /** Appends the row, or replaces the row with the same id in place. */
  set(row: Omit<Row, 'index' | 'slot'>) {
    const existing = this.indexById.get(String(row.id));
    if (existing !== undefined) {
      this.items[existing] = { ...row, index: existing, slot: this.items[existing].slot };
      this.reindexFrom(existing);
      return;
    }

    const index = this.items.length;
    this.items.push({ ...row, index, slot: index });
    this.indexById.set(String(row.id), index);
    this.tops.push(this.end);
    this.end += Math.round(row.height);
  }

  /**
   * Removes the rows with the given ids, ignoring unknown ones.
   * Returns the slots of the removed rows in ascending order, which the column stores must drop too.
   */
  removeMany(ids: Key[]): number[] {
    const removed = new Set<Row>();
    ids.forEach(id => {
      const row = this.get(id);
      if (row) removed.add(row);
    });
    if (removed.size === 0) return [];

    const slots = Array.from(removed, row => row.slot).sort((a, b) => a - b);
    const first = Array.from(removed).reduce((lowest, row) => Math.min(lowest, row.index), Infinity);
    removed.forEach(row => this.indexById.delete(String(row.id)));
    this.items = this.items.filter(row => !removed.has(row));

    // slots stay dense: every row moves down by the number of removed slots below it
    const shiftAt = new Int32Array(this.items.length + slots.length);
    for (let slot = 0, next = 0; slot < shiftAt.length; slot++) {
      if (slots[next] === slot) next++;
      shiftAt[slot] = next;
    }
    this.items.forEach(row => {
      row.slot -= shiftAt[row.slot];
    });

    this.reindexFrom(first);
    return slots;
  }

  /** Reorders the rows; the sort is stable, so equal rows keep their relative order. */
  sort(compare: (a: Row, b: Row) => number) {
    this.items.sort(compare);
    this.reindexFrom(0);
  }

  clear() {
    this.items = [];
    this.indexById.clear();
    this.tops = [];
    this.end = 0;
  }

  /** Recomputes positions and offsets from `from` onwards. */
  private reindexFrom(from: number) {
    this.tops.length = this.items.length;
    let top = from === 0 ? 0 : this.tops[from - 1] + Math.round(this.items[from - 1].height);
    for (let index = from; index < this.items.length; index++) {
      const row = this.items[index];
      row.index = index;
      this.indexById.set(String(row.id), index);
      this.tops[index] = top;
      top += Math.round(row.height);
    }
    this.end = top;
  }
}

export default RowStore;
