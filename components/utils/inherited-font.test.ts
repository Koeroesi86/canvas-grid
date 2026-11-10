import { describe, expect, it } from 'vitest';
import { resolveFont } from './inherited-font';

const style = { fontStyle: 'italic', fontWeight: '600', fontSize: '14px', fontFamily: 'Inter, "Helvetica Neue", sans-serif' };

describe('resolveFont', () => {
  it('passes an explicit font through', () => {
    expect(resolveFont('12px serif', style, '10px monospace')).toBe('12px serif');
  });

  it('builds the font from the computed style', () => {
    expect(resolveFont('inherit', style, '10px monospace')).toBe('italic 600 14px Inter, "Helvetica Neue", sans-serif');
  });

  it('skips empty parts', () => {
    expect(resolveFont('inherit', { ...style, fontStyle: '' }, '10px monospace')).toBe('600 14px Inter, "Helvetica Neue", sans-serif');
  });

  it('falls back when the element has no computed font', () => {
    expect(resolveFont('inherit', { ...style, fontSize: '' }, '10px monospace')).toBe('10px monospace');
  });
});
