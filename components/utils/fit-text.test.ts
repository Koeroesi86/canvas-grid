import { describe, expect, it } from 'vitest';
import fitText from './fit-text';

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
});
