import Renderer from '../utils/renderer';
import { primitive } from '../utils/jsx';
import fitText from '../utils/fit-text';
import type { ExactFit, FitCache } from '../utils/fit-text';
import { getContext2d } from '../utils/canvas';
import type { RenderProps } from '../types';

export interface TextStyle {
  /** Canvas `textRendering`: trade speed for legibility or exact geometry. Browser default is `'auto'`. */
  textRendering: CanvasTextRendering;
  /** Canvas `fontKerning`. Browser default is `'auto'`. */
  fontKerning: CanvasFontKerning;
  /** Extra space after each character, a CSS length such as `'0.5px'`. */
  letterSpacing: string;
  /**
   * `'ltr'` and `'rtl'` set the direction of every cell; `'auto'` picks it per cell from the first letter,
   * so mixed data works. Right-to-left text is aligned to the right of the cell.
   */
  direction: 'ltr' | 'rtl' | 'auto';
}

export interface TextOptions extends TextStyle {
  ellipsis: string;
  cellPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  font: string;
  color: string;
  isEllipsisRight: boolean;
}

export const defaultTextStyle: Readonly<TextStyle> = {
  textRendering: 'auto',
  fontKerning: 'auto',
  letterSpacing: '0px',
  direction: 'ltr',
};

/** First letter of a right-to-left script (Hebrew, Arabic, Syriac, Thaana, N'Ko and their presentation forms). */
const rightToLeftLetter = /^[^\p{L}]*(?=[֐-ࣿיִ-﷿ﹰ-ﻼ])\p{L}/u;

class TextRenderer extends Renderer<TextOptions> {
  static readonly defaultOptions: TextOptions = {
    ...defaultTextStyle,
    ellipsis: '…',
    cellPadding: {
      top: 3,
      right: 3,
      bottom: 3,
      left: 3,
    },
    font: '12px monospace',
    color: '#fff',
    isEllipsisRight: true,
  };

  private readonly characterWidths = new Map<string, number>();

  private readonly fitted: FitCache = new Map();

  private readonly measureContext = getContext2d(document.createElement('canvas'));

  private measuredState = '';

  /** Set once a style option differs from the default, so grids that never touch them set nothing extra per cell. */
  private styled = false;

  constructor(options: Partial<TextOptions> = {}) {
    super({ ...TextRenderer.defaultOptions, ...options });
    this.styled = this.differsFromDefault();
  }

  private differsFromDefault() {
    return (Object.keys(defaultTextStyle) as Array<keyof TextStyle>).some(key => this.options[key] !== defaultTextStyle[key]);
  }

  set font(font: string) {
    if (this.options.font !== font) {
      this.options.font = font;
      this.clearCache();
    }
  }

  get font() {
    return this.options.font;
  }

  set color(color: string) {
    this.options.color = color;
  }

  get color() {
    return this.options.color;
  }

  /** Changes the text style; widths are measured again when something changed. */
  setStyle(style: Partial<TextStyle>) {
    if (!(Object.keys(style) as Array<keyof TextStyle>).some(key => style[key] !== this.options[key])) return;

    this.update(style);
    this.styled = this.styled || this.differsFromDefault();
    this.clearCache();
  }

  /** Text is drawn straight into the layer, whose transform already scales it to the device pixel ratio. */
  pixelRatio = 1;

  clearCache() {
    this.characterWidths.clear();
    this.fitted.clear();
    this.measuredState = '';
  }

  /** Gives the measuring context the font and style the text is drawn with. */
  private prepareMeasuring() {
    const { font, textRendering, fontKerning, letterSpacing } = this.options;
    const state = `${font}|${textRendering}|${fontKerning}|${letterSpacing}`;
    if (this.measuredState === state) return;

    this.measureContext.font = font;
    this.measureContext.textRendering = textRendering;
    this.measureContext.fontKerning = fontKerning;
    this.measureContext.letterSpacing = letterSpacing;
    this.measuredState = state;
    // in a monospace font the character widths add up to the width of any Latin text, so that text needs no measuring
    this.exactFit.sumIsExact = Math.abs(this.measureContext.measureText('i').width - this.measureContext.measureText('W').width) < 0.01;
  }

  /** Passed to `fitText` as they are, so drawing a cell allocates no closures. */
  private readonly widthOfCharacter = (character: string) => this.measureCharacter(character);

  /** What `fitText` needs to measure a cut cell exactly; `sumIsExact` follows the font, see `prepareMeasuring`. */
  private readonly exactFit: ExactFit = {
    measure: (text: string) => this.measureString(text),
    cache: this.fitted,
    sumIsExact: true,
  };

  /** Width of one character in the current font, measured once. */
  private measureCharacter(character: string) {
    const cached = this.characterWidths.get(character);
    if (cached !== undefined) return cached;

    this.prepareMeasuring();
    const width = this.measureContext.measureText(character).width;
    this.characterWidths.set(character, width);
    return width;
  }

  /** Width of a string as the browser lays it out: includes kerning, ligatures and joined scripts. */
  private measureString(text: string) {
    this.prepareMeasuring();
    return this.measureContext.measureText(text).width;
  }

  /** Sum of the character widths: exact for monospace fonts, a close upper bound for most others. */
  getTextWidth(text: string) {
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) totalWidth += this.measureCharacter(text.charAt(i));
    return totalWidth;
  }

  private isRightToLeft(text: string) {
    const { direction } = this.options;
    return direction === 'auto' ? rightToLeftLetter.test(text) : direction === 'rtl';
  }

  /**
   * Draws the text clipped with an ellipsis; `(x, y)` is the offset of the text box from `(originX, originY)`.
   * The whole string is drawn with one `fillText`: recording one command per cell is much cheaper than
   * one `drawImage` per character, and the browser keeps its own glyph cache.
   */
  paint(ctx: CanvasRenderingContext2D, { value = '', x = 0, y = 0, width = 0, height = 0 }: RenderProps, originX: number, originY: number) {
    const { cellPadding } = this.options;
    const available = width - cellPadding.left - cellPadding.right;
    const text = fitText(value, available, this.options.ellipsis, this.widthOfCharacter, this.exactFit);
    if (text === '' || height - cellPadding.top - cellPadding.bottom <= 0) return;

    const rightToLeft = this.styled && this.isRightToLeft(text);
    if (this.styled) {
      ctx.textRendering = this.options.textRendering;
      ctx.fontKerning = this.options.fontKerning;
      ctx.letterSpacing = this.options.letterSpacing;
      ctx.direction = rightToLeft ? 'rtl' : 'ltr';
    }
    ctx.font = this.options.font;
    ctx.fillStyle = this.options.color;
    ctx.textAlign = rightToLeft ? 'right' : 'left';
    // centred in the padded box, so fonts of different sizes line up in a row
    ctx.textBaseline = 'middle';
    // at a fractional pixel ratio (125%, 150% zoom) integer CSS pixels fall between device pixels and blur the glyphs
    const { pixelRatio } = this;
    const textX = rightToLeft ? originX + x + width - cellPadding.right : originX + x + cellPadding.left;
    ctx.fillText(
      text,
      Math.round(textX * pixelRatio) / pixelRatio,
      Math.round((originY + y + cellPadding.top + (height - cellPadding.top - cellPadding.bottom) / 2) * pixelRatio) / pixelRatio,
    );
  }

  readonly element = primitive<RenderProps>((ctx, props, x, y) => this.paint(ctx, props, x, y));
}

export default TextRenderer;
