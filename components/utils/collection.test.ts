import { describe, expect, it } from 'vitest';
import Collection from './collection';

const filled = () => {
  const collection = new Collection<string>();
  collection.set('a', 'A');
  collection.set('b', 'B');
  collection.set('c', 'C');
  return collection;
};

describe('Collection', () => {
  it('keeps insertion order and does not duplicate keys on overwrite', () => {
    const collection = filled();
    collection.set('a', 'A2');
    expect(collection.keys).toEqual(['a', 'b', 'c']);
    expect(collection.get('a')).toBe('A2');
    expect(collection.length).toBe(3);
  });

  it('add uses the current length as key', () => {
    const collection = new Collection<string>();
    collection.add('x');
    collection.add('y');
    expect(collection.keys).toEqual([0, 1]);
  });

  it('delete removes the value and key, and ignores unknown keys', () => {
    const collection = filled();
    collection.delete('b');
    collection.delete('missing');
    expect(collection.keys).toEqual(['a', 'c']);
    expect(collection.get('b')).toBeUndefined();
  });

  it('clear without matcher empties everything', () => {
    const collection = filled();
    collection.clear();
    expect(collection.length).toBe(0);
    expect(collection.get('a')).toBeUndefined();
  });

  it('forEach visits values in order with their keys', () => {
    const visited: string[] = [];
    filled().forEach((value, key) => visited.push(`${key}=${value}`));
    expect(visited).toEqual(['a=A', 'b=B', 'c=C']);
  });

  it('clear with matcher removes every matching entry', () => {
    const collection = filled();
    collection.clear(value => value !== 'B');
    expect(collection.keys).toEqual(['b']);
  });

  it('clear with matcher does not skip adjacent matches', () => {
    const collection = filled();
    collection.clear(value => value !== 'C');
    expect(collection.keys).toEqual(['c']);
  });
});
