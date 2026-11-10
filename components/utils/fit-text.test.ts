import { describe, expect, it, vi } from 'vitest';
import fitText from './fit-text';
import type { FitCache } from './fit-text';

/** Every character is 10 wide, the ellipsis too. */
const tenWide = () => 10;

describe('fitText', () => {
  it('returns text that fits as it is', () => {
    expect(fitText('abcde', 50, '…', tenWide)).toBe('abcde');
    expect(fitText('', 50, '…', tenWide)).toBe('');
  });

  it('cuts text that does not fit and leaves room for the ellipsis', () => {
    expect(fitText('abcdefgh', 50, '…', tenWide)).toBe('abcd…');
  });

  it('does not cut text that fits exactly', () => {
    expect(fitText('abcde', 50, '…', tenWide)).toBe('abcde');
    expect(fitText('abcdef', 50, '…', tenWide)).toBe('abcd…');
  });

  it('draws nothing when not even the ellipsis fits', () => {
    expect(fitText('abc', 5, '…', tenWide)).toBe('');
    expect(fitText('abc', 0, '…', tenWide)).toBe('');
  });

  it('uses each character\'s own width', () => {
    const widths: Record<string, number> = { i: 4, W: 14, '…': 12 };
    expect(fitText('iiiiWiiii', 40, '…', character => widths[character] ?? 8)).toBe('iiii…');
    expect(fitText('iiiii', 40, '…', character => widths[character] ?? 8)).toBe('iiiii');
  });

  it('keeps an emoji whole instead of cutting its surrogate pair', () => {
    expect(fitText('ab😀cdef', 40, '…', tenWide)).toBe('ab😀…');
    expect(fitText('abcd😀ef', 40, '…', tenWide)).toBe('abc…');
  });

  it('keeps a letter and its combining accent together', () => {
    const decomposed = 'e\u0301'.repeat(6);
    expect(fitText(decomposed, 40, '…', tenWide)).toBe('e\u0301'.repeat(3) + '…');
  });

  it('keeps a joined emoji sequence together', () => {
    const family = '👨‍👩‍👧';
    expect(fitText(`${family}${family}${family}`, 20, '…', tenWide)).toBe(`${family}…`);
    expect(fitText(`${family}${family}`, 20, '…', tenWide)).toBe(`${family}${family}`);
  });
});

describe('fitText with measured widths', () => {
  const proportional = (measure: (text: string) => number, cache?: FitCache) => ({ measure, cache, sumIsExact: false });

  /** Characters sum to 10 each, but the browser lays the text out 20% tighter (kerning, joined letters). */
  const tighter = (text: string) => text.length * 8;

  it('keeps text that fits when measured as a whole, though the character sum says it does not', () => {
    expect(fitText('abcdef', 50, '…', tenWide, proportional(tighter))).toBe('abcdef');
  });

  it('cuts at the measured width instead of the summed one', () => {
    expect(fitText('abcdefgh', 50, '…', tenWide, proportional(tighter))).toBe('abcde…');
  });

  it('shortens the estimate until the cut text really fits', () => {
    // measured wider than the sum: a quarter of the estimate is missing
    const wider = (text: string) => text.length * 12;
    expect(fitText('abcdefgh', 50, '…', tenWide, proportional(wider))).toBe('abc…');
  });

  it('draws nothing when not even the ellipsis fits the measured width', () => {
    expect(fitText('abcdefgh', 5, '…', tenWide, proportional(tighter))).toBe('');
  });

  it('remembers the cut for the same text and width, and measures again for another width', () => {
    const cache = new Map();
    const measure = vi.fn(tighter);
    expect(fitText('abcdefgh', 50, '…', tenWide, proportional(measure, cache))).toBe('abcde…');
    const calls = measure.mock.calls.length;
    expect(fitText('abcdefgh', 50, '…', tenWide, proportional(measure, cache))).toBe('abcde…');
    expect(measure).toHaveBeenCalledTimes(calls);
    expect(fitText('abcdefgh', 34, '…', tenWide, proportional(measure, cache))).toBe('abc…');
    expect(measure.mock.calls.length).toBeGreaterThan(calls);
  });

  it('measures nothing for text that fits by the character sum', () => {
    const measure = vi.fn(tighter);
    expect(fitText('abcde', 50, '…', tenWide, proportional(measure))).toBe('abcde');
    expect(measure).not.toHaveBeenCalled();
  });

  it('does not measure a cut cell when the character sum is exact and the text is Latin', () => {
    const measure = vi.fn(tighter);
    expect(fitText('abcdefgh', 50, '…', tenWide, { measure, sumIsExact: true })).toBe('abcd…');
    expect(measure).not.toHaveBeenCalled();
  });

  it('measures non-Latin text even when the character sum is exact, as joined scripts shrink', () => {
    const measure = vi.fn((text: string) => text.length * 4);
    expect(fitText('שלום עולם!', 50, '…', tenWide, { measure, sumIsExact: true })).toBe('שלום עולם!');
    expect(measure).toHaveBeenCalled();
  });
});
