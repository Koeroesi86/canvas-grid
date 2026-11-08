/**
 * Values of one column for all rows, indexed by row slot. Two flat arrays instead of an object per cell.
 * `undefined` means the row has no value in this column.
 */
class ColumnStore {
  values: unknown[];

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
    while (this.values.length < slot) this.values.push(undefined);
    this.values[slot] = value;
    if (updatedAt === undefined && this.updatedAt === undefined) return;

    this.updatedAt ??= new Array(this.values.length).fill(0);
    while (this.updatedAt.length < this.values.length) this.updatedAt.push(0);
    this.updatedAt[slot] = updatedAt ?? 0;
  }

  /** Drops the values of the given slots (ascending) and shifts the following ones down. */
  removeSlots(slots: readonly number[]) {
    if (slots.length === 0) return;

    const compact = <T>(items: T[]) => {
      let write = 0;
      let removed = 0;
      for (let read = 0; read < items.length; read++) {
        if (removed < slots.length && slots[removed] === read) {
          removed++;
          continue;
        }
        items[write++] = items[read];
      }
      items.length = write;
    };

    compact(this.values);
    if (this.updatedAt) compact(this.updatedAt);
  }
}

export default ColumnStore;
