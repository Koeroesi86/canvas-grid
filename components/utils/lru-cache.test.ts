import { describe, expect, it } from 'vitest';
import LruCache from './lru-cache';

describe('LruCache', () => {
  it('stores and returns values', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts the least recently set entry past the limit', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  it('keeps entries that were read recently', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('overwriting a key does not grow the cache', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 1);
    cache.set('a', 2);
    expect(cache.size).toBe(1);
    expect(cache.get('a')).toBe(2);
  });

  it('clear empties the cache', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 1);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
