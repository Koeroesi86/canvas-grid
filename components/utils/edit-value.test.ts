import { describe, expect, it } from 'vitest';
import { editorKind, parseNumber, resolveEdit } from './edit-value';

const custom = () => { throw new Error('not built'); };
const change = { rowId: 1, rowIndex: 0, columnId: 'a', columnIndex: 0, value: 5, oldValue: 5 };

describe('parseNumber', () => {
  it('parses numbers, treats empty text as no value and rejects the rest', () => {
    expect(parseNumber('12.5')).toBe(12.5);
    expect(parseNumber('  ')).toBeUndefined();
    expect(() => parseNumber('abc')).toThrow('Not a number');
  });
});

describe('editorKind', () => {
  it('defaults to text and tells custom editors apart', () => {
    expect(editorKind(undefined)).toBe('text');
    expect(editorKind('checkbox')).toBe('checkbox');
    expect(editorKind(custom)).toBe('custom');
  });
});

describe('resolveEdit', () => {
  it('keeps text as it is without a parser', () => {
    expect(resolveEdit('hi', 'text', {}, change)).toEqual({ ok: true, value: 'hi' });
  });

  it('parses the text of a number editor by default', () => {
    expect(resolveEdit('3', 'number', {}, change)).toEqual({ ok: true, value: 3 });
    expect(resolveEdit('x', 'number', {}, change)).toEqual({ ok: false, message: 'Not a number' });
  });

  it('prefers the column parser, and reports what it throws', () => {
    const parse = (text: string) => {
      if (!text.startsWith('$')) throw new Error('Needs a $');
      return Number(text.slice(1));
    };
    expect(resolveEdit('$4', 'number', { parse }, change)).toEqual({ ok: true, value: 4 });
    expect(resolveEdit('4', 'text', { parse }, change)).toEqual({ ok: false, message: 'Needs a $' });
  });

  it('does not parse values of editors that are not text', () => {
    const parse = () => { throw new Error('never'); };
    expect(resolveEdit(true, 'checkbox', { parse }, change)).toEqual({ ok: true, value: true });
    expect(resolveEdit('x', custom, { parse }, change)).toEqual({ ok: true, value: 'x' });
  });

  it('validates the parsed value with the change', () => {
    const validate = (value: unknown, { oldValue }: { oldValue: unknown }) => (Number(value) > Number(oldValue) ? true : 'Must grow');
    expect(resolveEdit('9', 'number', { validate }, change)).toEqual({ ok: true, value: 9 });
    expect(resolveEdit('1', 'number', { validate }, change)).toEqual({ ok: false, message: 'Must grow' });
    expect(resolveEdit('1', 'number', { validate: () => false }, change)).toEqual({ ok: false, message: 'Invalid value' });
  });
});
