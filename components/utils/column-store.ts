/**
 * Values of one column for all rows, indexed by row slot. Two flat arrays instead of an object per cell.
 * `undefined` means the row has no value in this column.
 */
class ColumnStore {
  values: unknown[];

  /** Changes whenever a value is set, cleared or moved, so results computed from the values can be reused while it stays the same. */
  version = 0;

  /** When each value last changed, 0 when unknown; only allocated once a value changes after loading. */
  private updatedAt: number[] | undefined = undefined;

  constructor(length = 0) {
    this.values = new Array(length).fill(undefined);
  }

  get(slot: number) {
    return this.values[slot];
  }

  getUpdatedAt(slot: number): number | undefined {
    return this.updatedAt?.[slot] || undefined;
  }

  set(slot: number, value: unknown, updatedAt?: number) {
    this.version++;
    while (this.values.length < slot) this.values.push(undefined);
    this.values[slot] = value;
    if (updatedAt === undefined && this.updatedAt === undefined) return;

    this.updatedAt ??= new Array(this.values.length).fill(0);
    while (this.updatedAt.length < this.values.length) this.updatedAt.push(0);
    this.updatedAt[slot] = updatedAt ?? 0;
  }

  /** Empties the given slots, leaving holes; the other slots keep their place. */
  clearSlots(slots: readonly number[]) {
    this.version++;
    slots.forEach(slot => {
      if (slot < this.values.length) this.values[slot] = undefined;
      if (this.updatedAt && slot < this.updatedAt.length) this.updatedAt[slot] = 0;
    });
  }

  /** Keeps only the given slots (ascending), renumbering them 0, 1, 2... in that order. */
  compact(slots: ArrayLike<number>) {
    this.version++;
    this.values = Array.from(slots, slot => this.values[slot]);
    const { updatedAt } = this;
    if (updatedAt) this.updatedAt = Array.from(slots, slot => updatedAt[slot] ?? 0);
  }
}

export default ColumnStore;
