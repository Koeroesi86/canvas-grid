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
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
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
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    expect(renderer.getTextWidth('abab')).toBe(40);
    expect(measureText).toHaveBeenCalledTimes(2);
  });

  it('measures again after the font changed', () => {
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    expect(renderer.getTextWidth('ab')).toBe(20);
    renderer.font = '20px a';
    expect(renderer.getTextWidth('ab')).toBe(40);
  });

  it('keeps the cache when the same font is set again', () => {
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    renderer.getTextWidth('ab');
    renderer.font = '10px a';
    renderer.getTextWidth('ab');
    expect(measureText).toHaveBeenCalledTimes(2);
  });

  it('measures again after clearCache, as when web fonts finish loading', () => {
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    renderer.getTextWidth('ab');
    renderer.clearCache();
    renderer.getTextWidth('ab');
    expect(measureText).toHaveBeenCalledTimes(4);
  });
});

describe('TextRenderer per-font measurements', () => {
  it('keeps the widths of each font apart', () => {
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    const props = { value: 'ab', width: 100, height: 20 };
    const ctx = createPaintContext();
    renderer.paint(ctx as never, props, 0, 0);
    renderer.paint(ctx as never, { ...props, font: '20px a' }, 0, 0);
    renderer.paint(ctx as never, props, 0, 0);
    renderer.paint(ctx as never, { ...props, font: '20px a' }, 0, 0);
    // 'a' and 'b' once in 10px and once in 20px, and never again
    expect(measureText).toHaveBeenCalledTimes(4);
  });

  it('draws and cuts a cell in the font it is given', () => {
    const ctx = createPaintContext();
    // 46px wide, 6px padding: 40px, and a character is 20px wide in this font
    new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' }).paint(ctx as never, { value: 'hello', width: 46, height: 20, font: '20px a' }, 0, 0);
    expect(ctx.font).toBe('20px a');
    expect(ctx.fillText.mock.calls[0][0]).toBe('h…');
  });

  it('uses its own font for cells without one', () => {
    const ctx = createPaintContext();
    new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' }).paint(ctx as never, { value: 'hello', width: 46, height: 20 }, 0, 0);
    expect(ctx.font).toBe('10px a');
    expect(ctx.fillText.mock.calls[0][0]).toBe('hel…');
  });

  it('measures all fonts again after clearCache', () => {
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    const props = { value: 'ab', width: 100, height: 20 };
    const ctx = createPaintContext();
    renderer.paint(ctx as never, props, 0, 0);
    renderer.paint(ctx as never, { ...props, font: '20px a' }, 0, 0);
    renderer.clearCache();
    renderer.paint(ctx as never, props, 0, 0);
    renderer.paint(ctx as never, { ...props, font: '20px a' }, 0, 0);
    expect(measureText).toHaveBeenCalledTimes(8);
  });

  it('tells monospace and proportional fonts apart per font', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px mono' });
    // in the proportional font 'i' is narrow and kerning makes a whole string 25% narrower than its characters
    const measure = vi.spyOn(fakeMeasureContext, 'measureText').mockImplementation(((text: string) => {
      if (!fakeMeasureContext.font.includes('prop')) return { width: 8 * text.length };
      return { width: text === 'i' ? 3 : text.length === 1 ? 8 : 6 * text.length };
    }) as never);
    try {
      const props = { value: 'abcdefgh', width: 56, height: 20 };
      // 50px available: monospace characters add up to 64px, so the text is cut
      renderer.paint(ctx as never, props, 0, 0);
      expect(ctx.fillText.mock.calls[0][0]).toBe('abcde…');
      // measured as a whole it is 48px and fits, though its characters add up to 64px
      renderer.paint(ctx as never, { ...props, font: '10px prop' }, 0, 0);
      expect(ctx.fillText.mock.calls[1][0]).toBe('abcdefgh');
    } finally {
      measure.mockRestore();
    }
  });
});

describe('TextRenderer text style', () => {
  it('measures again after the style changed, since it changes the widths', () => {
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    renderer.getTextWidth('ab');
    renderer.setStyle({ letterSpacing: '2px' });
    renderer.getTextWidth('ab');
    expect(measureText).toHaveBeenCalledTimes(4);
    expect(fakeMeasureContext).toMatchObject({ letterSpacing: '2px' });
  });

  it('does not measure again when the style is the same', () => {
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
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
    new TextRenderer({ textOverflow: 'ellipsis', font: '10px a', cellPadding: { top: 2, right: 3, bottom: 4, left: 3 } }).paint(ctx as never, props, 10, 100);
    expect(ctx.textBaseline).toBe('middle');
    expect(ctx.fillText).toHaveBeenCalledWith('hello', 13, 100 + 2 + (20 - 2 - 4) / 2);
  });

  it('snaps the position to device pixels', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    renderer.pixelRatio = 1.5;
    renderer.paint(ctx as never, props, 0, 0);
    const [, x, y] = ctx.fillText.mock.calls[0];
    // 3px of padding is 4.5 device pixels, snapped to 5
    expect(x).toBeCloseTo(5 / 1.5);
    expect(y).toBeCloseTo(10);
  });

  it('cuts the text with an ellipsis when it does not fit', () => {
    const ctx = createPaintContext();
    new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' }).paint(ctx as never, { ...props, width: 46 }, 0, 0);
    expect(ctx.fillText.mock.calls[0][0]).toBe('hel…');
  });

  it('draws nothing when the padded box has no height', () => {
    const ctx = createPaintContext();
    new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' }).paint(ctx as never, { ...props, height: 6 }, 0, 0);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('leaves the context style alone until an option is set', () => {
    const ctx = createPaintContext();
    new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' }).paint(ctx as never, props, 0, 0);
    expect(ctx).toMatchObject({ textRendering: '', fontKerning: '', letterSpacing: '', direction: '', textAlign: 'left' });
  });

  it('applies the style options to the context', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    renderer.setStyle({ textRendering: 'optimizeLegibility', fontKerning: 'none', letterSpacing: '1px' });
    renderer.paint(ctx as never, props, 0, 0);
    expect(ctx).toMatchObject({ textRendering: 'optimizeLegibility', fontKerning: 'none', letterSpacing: '1px', direction: 'ltr' });
  });

  it('right-aligns right-to-left text from the cell\'s right edge', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    renderer.setStyle({ direction: 'rtl' });
    renderer.paint(ctx as never, { ...props, value: 'abc' }, 10, 0);
    expect(ctx).toMatchObject({ direction: 'rtl', textAlign: 'right' });
    expect(ctx.fillText).toHaveBeenCalledWith('abc', 10 + 100 - 3, 10);
  });

  it('picks the direction per cell with auto, from the first letter', () => {
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
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
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    renderer.paint(ctx as never, { ...props, value: 'abcdefgh', width: 56 }, 0, 0);
    expect(ctx.fillText.mock.calls[0][0]).toBe('abcd…');
    expect(measureText.mock.calls.every(([text]) => text.length === 1)).toBe(true);
  });

  it('measures a cut cell as a whole in a proportional font, so kerned text is not cut early', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    const measure = vi.spyOn(fakeMeasureContext, 'measureText').mockImplementation((text: string) => ({ width: text === 'i' ? 4 : text.length * 8 }) as TextMetrics);
    renderer.paint(ctx as never, { ...props, value: 'abcdef', width: 56 }, 0, 0);
    expect(ctx.fillText.mock.calls[0][0]).toBe('abcdef');
    measure.mockRestore();
  });

  it('measures each character pair once and cuts kerned text without measuring whole cells', () => {
    const ctx = createPaintContext();
    const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
    // "AV" is 4px tighter than its letters; every other pair adds up
    const measure = vi.spyOn(fakeMeasureContext, 'measureText').mockImplementation((text: string) => ({
      width: text === 'i' ? 4 : text.length * 8 - (text === 'AV' ? 4 : 0),
    }) as TextMetrics);
    const props = { value: '', x: 0, y: 0, height: 20, width: 56 };
    renderer.paint(ctx as never, { ...props, value: 'AVAVAVAVAV' }, 0, 0);
    expect(ctx.fillText.mock.calls[0][0]).toBe('AVAVAV…');
    const wholeCells = () => measure.mock.calls.filter(([text]) => text.length > 2).length;
    const pairs = () => measure.mock.calls.filter(([text]) => text.length === 2).length;
    const measuredPairs = pairs();
    renderer.paint(ctx as never, { ...props, value: 'AVAVAVAVAVAV' }, 0, 0);
    expect(wholeCells()).toBe(0);
    expect(pairs()).toBe(measuredPairs);
    measure.mockRestore();
  });

  describe('textOverflow clip', () => {
    it('draws the whole text inside a clip of the padded cell when it may be wider, measuring single characters only', () => {
      const ctx = createPaintContext();
      const renderer = new TextRenderer({ font: '10px a' });
      renderer.paint(ctx as never, { ...props, value: 'abcdefghijkl', x: 5, y: 7, width: 56 }, 10, 20);
      expect(ctx.fillText.mock.calls[0][0]).toBe('abcdefghijkl');
      expect(ctx.rect).toHaveBeenCalledWith(10 + 5 + 3, 20 + 7, 50, 20);
      expect(ctx.clip).toHaveBeenCalledTimes(1);
      expect(ctx.save).toHaveBeenCalledTimes(1);
      expect(ctx.restore).toHaveBeenCalledTimes(1);
      expect(measureText.mock.calls.every(([text]) => text.length === 1)).toBe(true);
    });

    it('does not clip text that fits by the character widths', () => {
      const ctx = createPaintContext();
      const renderer = new TextRenderer({ font: '10px a' });
      renderer.paint(ctx as never, { ...props, value: 'abcde', width: 56 }, 0, 0);
      expect(ctx.fillText.mock.calls[0][0]).toBe('abcde');
      expect(ctx.save).not.toHaveBeenCalled();
    });

    it('clips text beyond Latin, whose widths do not add up', () => {
      const ctx = createPaintContext();
      const renderer = new TextRenderer({ font: '10px a' });
      renderer.paint(ctx as never, { ...props, value: 'שלום', width: 200 }, 0, 0);
      expect(ctx.clip).toHaveBeenCalledTimes(1);
    });

    it('does not clip or restore anything with ellipsis', () => {
      const ctx = createPaintContext();
      const renderer = new TextRenderer({ textOverflow: 'ellipsis', font: '10px a' });
      renderer.paint(ctx as never, { ...props, value: 'abcdefghijkl', width: 56 }, 0, 0);
      expect(ctx.save).not.toHaveBeenCalled();
      expect(ctx.clip).not.toHaveBeenCalled();
    });

    it('switches with the style, and does not make the renderer set canvas styles per cell', () => {
      const ctx = createPaintContext();
      const renderer = new TextRenderer({ font: '10px a' });
      renderer.setStyle({ textOverflow: 'ellipsis' });
      renderer.paint(ctx as never, { ...props, value: 'abcdefgh', width: 56 }, 0, 0);
      expect(ctx.fillText.mock.calls[0][0]).toBe('abcd…');
      expect(ctx.textRendering).toBe('');
    });
  });
});
