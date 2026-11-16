import { describe, expect, it } from 'vitest';
import { escapeField, toTsv } from './clipboard';

describe('escapeField', () => {
  it('leaves plain text alone', () => {
    expect(escapeField('12.5')).toBe('12.5');
    expect(escapeField('')).toBe('');
    expect(escapeField('two words')).toBe('two words');
  });

  it('quotes text with a tab, a line break or a quote, and doubles the quotes', () => {
    expect(escapeField('a\tb')).toBe('"a\tb"');
    expect(escapeField('a\nb')).toBe('"a\nb"');
    expect(escapeField('a\r\nb')).toBe('"a\r\nb"');
    expect(escapeField('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('toTsv', () => {
  const textAt = (row: number, column: number) => `${row}:${column}`;

  it('separates cells with tabs and rows with line breaks', () => {
    expect(toTsv({ top: 1, bottom: 2, left: 0, right: 2 }, textAt)).toEqual({
      text: '1:0\t1:1\t1:2\r\n2:0\t2:1\t2:2',
      truncated: false,
    });
  });

  it('copies one cell as its text alone', () => {
    expect(toTsv({ top: 4, bottom: 4, left: 3, right: 3 }, textAt).text).toBe('4:3');
  });

  it('quotes fields that need it and keeps empty cells', () => {
    const values = [['a\tb', ''], ['say "x"', 'ok']];
    expect(toTsv({ top: 0, bottom: 1, left: 0, right: 1 }, (row, column) => values[row][column]).text).toBe('"a\tb"\t\r\n"say ""x"""\tok');
  });

  it('stops after the rows that fit the limit', () => {
    const copied = toTsv({ top: 0, bottom: 9, left: 0, right: 2 }, textAt, 10);
    expect(copied.text.split('\r\n')).toHaveLength(3);
    expect(copied.truncated).toBe(true);
  });

  it('always includes one row, even a row wider than the limit', () => {
    const copied = toTsv({ top: 0, bottom: 4, left: 0, right: 9 }, textAt, 5);
    expect(copied.text.split('\r\n')).toHaveLength(1);
    expect(copied.truncated).toBe(true);
  });

  it('is not truncated when everything fits exactly', () => {
    expect(toTsv({ top: 0, bottom: 1, left: 0, right: 4 }, textAt, 10).truncated).toBe(false);
  });
});
