import type { Key } from '../types';

class Collection<T> {
  private items: Record<Key, T> = {};

  keys: Key[] = [];

  constructor() {
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.clear = this.clear.bind(this);
    this.forEach = this.forEach.bind(this);
  }

  get(key: Key): T | undefined {
    return this.items[key];
  }

  set(key: Key, value: T) {
    this.items[key] = value;
    if (!this.keys.includes(key)) {
      this.keys.push(key);
    }
  }

  add(value: T) {
    this.set(this.keys.length, value);
  }

  delete(key: Key) {
    delete this.items[key];
    const index = this.keys.indexOf(key);
    if (index !== -1) {
      this.keys.splice(index, 1);
    }
  }

  clear(matcher?: (item: T, key: Key) => boolean) {
    if (typeof matcher === 'function') {
      this.forEach((item, key) => {
        if (matcher(item, key)) this.delete(key);
      });
    } else {
      this.items = {};
      this.keys.splice(0);
    }
  }

  forEach(fn: (item: T, key: Key) => void) {
    this.keys.forEach(key => {
      fn(this.items[key], key);
    });
  }

  get length() {
    return this.keys.length;
  }
}

export default Collection;
