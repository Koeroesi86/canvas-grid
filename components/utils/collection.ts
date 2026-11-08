import type { Key } from '../types';

interface Entry<T> {
  key: Key;
  value: T;
}

/**
 * Insertion-ordered map. Keys are compared as strings (1 and '1' are the same entry),
 * and every operation is O(1) apart from iteration.
 */
class Collection<T> {
  private entries = new Map<string, Entry<T>>();

  constructor() {
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.clear = this.clear.bind(this);
    this.forEach = this.forEach.bind(this);
  }

  get keys(): Key[] {
    return Array.from(this.entries.values(), entry => entry.key);
  }

  get(key: Key): T | undefined {
    return this.entries.get(String(key))?.value;
  }

  set(key: Key, value: T) {
    const existing = this.entries.get(String(key));
    if (existing) {
      existing.value = value;
      return;
    }
    this.entries.set(String(key), { key, value });
  }

  add(value: T) {
    this.set(this.entries.size, value);
  }

  delete(key: Key) {
    this.entries.delete(String(key));
  }

  clear(matcher?: (item: T, key: Key) => boolean) {
    if (typeof matcher !== 'function') {
      this.entries.clear();
      return;
    }
    this.entries.forEach(({ key, value }, id) => {
      if (matcher(value, key)) this.entries.delete(id);
    });
  }

  forEach(fn: (item: T, key: Key) => void) {
    this.entries.forEach(({ key, value }) => fn(value, key));
  }

  get length() {
    return this.entries.size;
  }
}

export default Collection;
