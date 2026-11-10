import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TextRenderer from './index';

/** Every character is as wide as the font size, so a font change changes every width. */
const measureText = vi.fn();
const fakeMeasureContext = {
  font: '10px a',
  measureText: (character: string) => {
    // 'i' and 'W' are how the renderer tells a monospace font apart, not text being drawn
    if (character !== 'i' && character !== 'W') measureText(character);
    return { width: Number.parseInt(fakeMeasureContext.font, 10) * character.length };
  },
};

const createPaintContext = () => ({
  font: '',
  textRendering: '',
  fontKerning: '',
  letterSpacing: '',
  direction: '',
  fillStyle: '',
  textAlign: '',
  textBaseline: '',
  fillText: vi.fn(),
});

beforeEach(() => {
  measureText.mockClear();
  fakeMeasureContext.font = '10px a';
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => fakeMeasureContext }) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TextRenderer measurement cache', () => {
  it('measures each character once per font', () => {
    const renderer = new TextRenderer({ font: '10px a' });
    expect(renderer.getTextWidth('abab')).toBe(40);
    expect(measureText).toHaveBeenCalledTimes(2);
  });

  it('measures again after the font changed', () => {
    const renderer = new TextRenderer({ font: '10px a' });
    expect(renderer.getTextWidth('ab')).toBe(20);
    renderer.font = '20px a';
    expect(renderer.getTextWidth('ab')).toBe(40);
  });

  it('keeps the cache when the same font is set again', () => {
    const renderer = new TextRenderer({ font: '10px a' });
    renderer.getTextWidth('ab');
    renderer.font = '10px a';
    renderer.getTextWidth('ab');
    expect(measureText).toHaveBeenCalledTimes(2);
  });

  it('measures again after clearCache, as when web fonts finish loading', () => {
    const renderer = new TextRenderer({ font: '10px a' });
    renderer.getTextWidth('ab');
    renderer.clearCache();
    renderer.getTextWidth('ab');
    expect(measureText).toHaveBeenCalledTimes(4);
  });
});

describe('TextRenderer text style', () => {
  it('measures again after the style changed, since it changes the widths', () => {
    const renderer = new TextRenderer({ font: '10px a' });
    renderer.getTextWidth('ab');
    renderer.setStyle({ letterSpacing: '2px' });
    renderer.getTextWidth('ab');
    expect(measureText).toHaveBeenCalledTimes(4);
    expect(fakeMeasureContext).toMatchObject({ letterSpacing: '2px' });
  });

  it('does not measure again when the style is the same', () => {
    const renderer = new TextRenderer({ font: '10px a' });
    renderer.getTextWidth('ab');
    renderer.setStyle({ letterSpacing: '0px', direction: 'ltr' });
    renderer.getTextWidth('ab');
    expect(measureText).toHaveBeenCalledTimes(2);
  });
});

describe('TextRenderer paint', () => {
  const props = { value: 'hello', x: 0, y: 0, width: 100, height: 20 };

  it('draws the text centred in the padded box', () => {
    const ctx = createPaintContext();
    new TextRenderer({ font: '10px a', cellPadding: { top: 2, right: 3, bottom: 4, left: 3 } }).paint(ctx as never, props, 10, 100);
    expect(ctx.textBaseline).toBe('middle');
    expect(ctx.fillText).toHaveBeenCalledWith('hello', 13, 100 + 2 + (20 - 2 - 4) / 2);
  });

  it('snaps the position to device pixels', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ font: '10px a' });
    renderer.pixelRatio = 1.5;
    renderer.paint(ctx as never, props, 0, 0);
    const [, x, y] = ctx.fillText.mock.calls[0];
    // 3px of padding is 4.5 device pixels, snapped to 5
    expect(x).toBeCloseTo(5 / 1.5);
    expect(y).toBeCloseTo(10);
  });

  it('cuts the text with an ellipsis when it does not fit', () => {
    const ctx = createPaintContext();
    new TextRenderer({ font: '10px a' }).paint(ctx as never, { ...props, width: 46 }, 0, 0);
    expect(ctx.fillText.mock.calls[0][0]).toBe('hel…');
  });

  it('draws nothing when the padded box has no height', () => {
    const ctx = createPaintContext();
    new TextRenderer({ font: '10px a' }).paint(ctx as never, { ...props, height: 6 }, 0, 0);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('leaves the context style alone until an option is set', () => {
    const ctx = createPaintContext();
    new TextRenderer({ font: '10px a' }).paint(ctx as never, props, 0, 0);
    expect(ctx).toMatchObject({ textRendering: '', fontKerning: '', letterSpacing: '', direction: '', textAlign: 'left' });
  });

  it('applies the style options to the context', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ font: '10px a' });
    renderer.setStyle({ textRendering: 'optimizeLegibility', fontKerning: 'none', letterSpacing: '1px' });
    renderer.paint(ctx as never, props, 0, 0);
    expect(ctx).toMatchObject({ textRendering: 'optimizeLegibility', fontKerning: 'none', letterSpacing: '1px', direction: 'ltr' });
  });

  it('right-aligns right-to-left text from the cell\'s right edge', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ font: '10px a' });
    renderer.setStyle({ direction: 'rtl' });
    renderer.paint(ctx as never, { ...props, value: 'abc' }, 10, 0);
    expect(ctx).toMatchObject({ direction: 'rtl', textAlign: 'right' });
    expect(ctx.fillText).toHaveBeenCalledWith('abc', 10 + 100 - 3, 10);
  });

  it('picks the direction per cell with auto, from the first letter', () => {
    const renderer = new TextRenderer({ font: '10px a' });
    renderer.setStyle({ direction: 'auto' });
    const direction = (value: string) => {
      const ctx = createPaintContext();
      renderer.paint(ctx as never, { ...props, value }, 0, 0);
      return ctx.direction;
    };
    expect(direction('hello')).toBe('ltr');
    expect(direction('שלום')).toBe('rtl');
    expect(direction('مرحبا بالعالم')).toBe('rtl');
    expect(direction('12 שלום')).toBe('rtl');
    expect(direction('Price שלום')).toBe('ltr');
    expect(direction('123')).toBe('ltr');
    expect(direction('١٢٣ abc')).toBe('ltr');
  });

  it('does not measure whole cells in a monospace font, where the character sum is exact', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ font: '10px a' });
    renderer.paint(ctx as never, { ...props, value: 'abcdefgh', width: 56 }, 0, 0);
    expect(ctx.fillText.mock.calls[0][0]).toBe('abcd…');
    expect(measureText.mock.calls.every(([text]) => text.length === 1)).toBe(true);
  });

  it('measures a cut cell as a whole in a proportional font, so kerned text is not cut early', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ font: '10px a' });
    const measure = vi.spyOn(fakeMeasureContext, 'measureText').mockImplementation((text: string) => ({ width: text === 'i' ? 4 : text.length * 8 }) as TextMetrics);
    renderer.paint(ctx as never, { ...props, value: 'abcdef', width: 56 }, 0, 0);
    expect(ctx.fillText.mock.calls[0][0]).toBe('abcdef');
    measure.mockRestore();
  });
});
