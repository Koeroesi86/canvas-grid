import type { Key, RowData, RowId } from '../types';

export type Row = RowData;

/** Holes below this are not worth a pass over every column. */
const MIN_HOLES_TO_COMPACT = 1024;

/**
 * Rows in display order: a dense array with an id lookup and each row's top offset,
 * so appends, lookups and finding the row at a scroll offset never scan every row.
 * Removing rows renumbers the positions after the first removed one (once per call).
 * Rows keep a `slot` into the column stores that does not change when the rows are sorted or others removed;
 * removed rows leave holes, which are closed when they outnumber the rows.
 */
class RowStore {
  private items: Row[] = [];

  private readonly byId = new Map<string, Row>();

  /** `tops[i]` is the offset of row `i` from the top of the first row. */
  private tops: number[] = [];

  private end = 0;

  /** Slots handed out so far, including holes left by removed rows. */
  private nextSlot = 0;

  get length() {
    return this.items.length;
  }

  /** Sum of all row heights. */
  get totalHeight() {
    return this.end;
  }

  /** Number of slots in use or left as holes; the length the column stores need. */
  get slotCount() {
    return this.nextSlot;
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
    const added = { ...row, index, slot: this.nextSlot++ };
    this.items.push(added);
    this.byId.set(String(row.id), added);
    this.tops.push(this.end);
    this.end += Math.round(row.height);
  }

  /**
   * Removes the rows with the given ids, ignoring unknown ones.
   * Returns the slots of the removed rows in ascending order, which the column stores must clear.
   * Other rows keep their slots, so removing costs nothing per column; see `compactSlots`.
   */
  removeMany(ids: Key[]): number[] {
    const removed = new Set<Row>();
    ids.forEach(id => {
      const row = this.get(id);
      if (row) removed.add(row);
    });
    if (removed.size === 0) return [];

    removed.forEach(row => this.byId.delete(String(row.id)));
    const indexes = Array.from(removed, row => row.index).sort((a, b) => a - b);

    // close the gaps in place, moving whole runs of surviving rows at once
    let write = indexes[0];
    indexes.forEach((removedIndex, at) => {
      const end = indexes[at + 1] ?? this.items.length;
      this.items.copyWithin(write, removedIndex + 1, end);
      write += end - removedIndex - 1;
    });
    this.items.length = write;

    this.reindexFrom(indexes[0]);
    return Array.from(removed, row => row.slot).sort((a, b) => a - b);
  }

  /**
   * Renumbers the slots densely once more than half of them are holes left by removed rows.
   * Returns the previous slots of the remaining rows in ascending order (the column stores keep exactly those),
   * or undefined when nothing was renumbered. Doing this rarely keeps removal cheap for streams that drop old rows.
   */
  compactSlots(): Int32Array | undefined {
    const holes = this.nextSlot - this.items.length;
    if (holes < MIN_HOLES_TO_COMPACT || holes <= this.items.length) return undefined;

    const live = Int32Array.from(this.items, row => row.slot).sort();
    const renumbered = new Int32Array(this.nextSlot);
    live.forEach((slot, rank) => { renumbered[slot] = rank; });
    this.items.forEach(row => { row.slot = renumbered[row.slot]; });
    this.nextSlot = this.items.length;
    return live;
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
    this.nextSlot = 0;
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
