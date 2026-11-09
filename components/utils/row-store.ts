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

  private readonly byId = new Map<string, Row>();

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
    return this.byId.get(String(id));
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
    const previous = this.byId.get(String(row.id));
    if (previous) {
      const replacement = { ...row, index: previous.index, slot: previous.slot };
      this.items[previous.index] = replacement;
      this.byId.set(String(row.id), replacement);
      this.reindexFrom(previous.index);
      return;
    }

    const index = this.items.length;
    const added = { ...row, index, slot: index };
    this.items.push(added);
    this.byId.set(String(row.id), added);
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
    removed.forEach(row => this.byId.delete(String(row.id)));
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

  /**
   * Puts the given rows back in order, assuming every other row is already ordered.
   * `compare` must be a total order (no ties), which a slot tiebreak provides. Costs one comparison pass per
   * moved row (a binary search) plus a copy, instead of sorting every row.
   */
  resort(ids: Iterable<Key>, compare: (a: Row, b: Row) => number) {
    const moving = new Set<Row>();
    for (const id of ids) {
      const row = this.get(id);
      if (row) moving.add(row);
    }
    if (moving.size === 0) return;

    const settled = this.items.filter(row => !moving.has(row));
    const inserts = Array.from(moving).sort(compare);
    const positions = inserts.map(row => this.lowerBound(settled, row, compare));

    const result: Row[] = [];
    let copied = 0;
    inserts.forEach((row, at) => {
      for (; copied < positions[at]; copied++) result.push(settled[copied]);
      result.push(row);
    });
    for (; copied < settled.length; copied++) result.push(settled[copied]);

    const firstMoved = Math.min(positions[0], ...Array.from(moving, row => row.index));
    this.items = result;
    this.reindexFrom(firstMoved);
  }

  clear() {
    this.items = [];
    this.byId.clear();
    this.tops = [];
    this.end = 0;
  }

  /** Index of the first row in `rows` that is not ordered before `row`. */
  private lowerBound(rows: Row[], row: Row, compare: (a: Row, b: Row) => number) {
    let low = 0;
    let high = rows.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (compare(rows[middle], row) < 0) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  /** Recomputes positions and offsets from `from` onwards. */
  private reindexFrom(from: number) {
    this.tops.length = this.items.length;
    let top = from === 0 ? 0 : this.tops[from - 1] + Math.round(this.items[from - 1].height);
    for (let index = from; index < this.items.length; index++) {
      const row = this.items[index];
      row.index = index;
      this.tops[index] = top;
      top += Math.round(row.height);
    }
    this.end = top;
  }
}

export default RowStore;
