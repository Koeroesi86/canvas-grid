/** Size-bounded map that evicts the least recently used entry first. */
class LruCache<T> {
  private readonly entries = new Map<string, T>();

  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    // re-insert so iteration order tracks recency
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: T) {
    this.entries.delete(key);
    this.entries.set(key, value);
    const [oldest] = this.entries.keys();
    if (this.entries.size > this.limit && oldest !== undefined) this.entries.delete(oldest);
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    return this.entries.size;
  }
}

export default LruCache;
