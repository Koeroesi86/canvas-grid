/**
 * Characters that join with their neighbours into one visible glyph: any combining mark (accents, Indic vowel signs and
 * viramas, Thai marks), the conjoining Hangul jamo, the zero width (non-)joiner and everything outside the BMP, which
 * is a surrogate pair in UTF-16 (most emoji). Text with any is measured per grapheme, not per UTF-16 unit.
 */
const joiningCharacters = /[\p{M}ᄀ-ᇿꥠ-꥿ힰ-퟿‌‍\u{10000}-\u{10ffff}]/u;

/** From here on come combining marks, Hebrew, Arabic, the other scripts that shape or join, CJK and emoji. */
const FIRST_COMPLEX_CODE = 0x300;

const segmenter = new Intl.Segmenter();

const toGraphemes = (text: string) => Array.from(segmenter.segment(text), ({ segment }) => segment);

const toUnits = (text: string) => (joiningCharacters.test(text) ? toGraphemes(text) : text);

const hasComplexCharacters = (text: string) => {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) >= FIRST_COMPLEX_CODE) return true;
  }
  return false;
};

/** How many leading units fit with room left for the ellipsis: all of them when everything fits, -1 when nothing does. */
const countFitting = (units: ArrayLike<string>, available: number, ellipsis: string, widthOf: (unit: string) => number) => {
  let used = 0;
  let end = 0;
  while (end < units.length) {
    const width = widthOf(units[end]);
    if (used + width > available) break;
    used += width;
    end++;
  }
  if (end === units.length) return end;

  // the ellipsis needs room too: give up units until it fits
  const ellipsisWidth = widthOf(ellipsis);
  while (end > 0 && used + ellipsisWidth > available) {
    end--;
    used -= widthOf(units[end]);
  }
  return used + ellipsisWidth > available ? -1 : end;
};

const sumWidths = (units: ArrayLike<string>, widthOf: (unit: string) => number) => {
  let total = 0;
  for (let i = 0; i < units.length; i++) total += widthOf(units[i]);
  return total;
};

/** The text that was cut to `available` pixels, remembered per text so a cell that is drawn again costs one lookup. */
export interface FittedText {
  available: number;
  text: string;
}

export type FitCache = Map<string, FittedText>;

const MAX_CACHED_TEXTS = 4096;

const remember = (cache: FitCache | undefined, text: string, available: number, fitted: string) => {
  if (!cache) return fitted;

  const entry = cache.get(text);
  if (entry) {
    entry.available = available;
    entry.text = fitted;
    return fitted;
  }
  if (cache.size >= MAX_CACHED_TEXTS) cache.clear();
  cache.set(text, { available, text: fitted });
  return fitted;
};

export interface ExactFit {
  /** Width of a string as the browser lays it out, with kerning, ligatures and joined scripts. */
  measure: (text: string) => number;
  /** Cuts already made, so a text that is drawn again is not measured again. */
  cache?: FitCache;
  /** The character widths add up to the real width, as for a monospace font: Latin text then needs no measuring. */
  sumIsExact: boolean;
  /**
   * How much wider (negative: narrower) two neighbouring characters are laid out than their own widths add up to:
   * kerning and ligatures. With it, simple Latin text is cut by arithmetic instead of by measuring.
   */
  kerning?: (left: string, right: string) => number;
}

/** Cuts the units to fit using real measurements: the character sum is only an estimate where to cut. */
const fitExactly = (text: string, available: number, ellipsis: string, widthOf: (unit: string) => number, exact: ExactFit) => {
  const { measure, cache } = exact;
  const cached = cache?.get(text);
  if (cached?.available === available) return cached.text;

  const units = toUnits(text);
  if (countFitting(units, available, ellipsis, widthOf) === units.length) return text;

  const whole = measure(text);
  if (whole <= available) return remember(cache, text, available, text);

  // estimate where to cut by scaling the widths to the measured total, then correct it against real measurements
  const scale = whole / sumWidths(units, widthOf);
  let keep = countFitting(units, available, ellipsis, unit => widthOf(unit) * scale);
  const prefix = (count: number) => (typeof units === 'string' ? units.slice(0, count) : units.slice(0, count).join(''));
  while (keep > 0 && measure(prefix(keep) + ellipsis) > available) keep--;
  return remember(cache, text, available, keep < 0 || (keep === 0 && measure(ellipsis) > available) ? '' : prefix(keep) + ellipsis);
};

/**
 * Cuts text of simple characters with the character widths corrected by the kerning of each pair, which is how the
 * browser lays out Latin text apart from rare effects over three or more letters. Measures nothing once the pairs are known.
 */
const fitKerned = (
  text: string,
  available: number,
  ellipsis: string,
  widthOf: (character: string) => number,
  kerning: (left: string, right: string) => number,
) => {
  const ellipsisWidth = widthOf(ellipsis);
  const ellipsisHead = ellipsis.charAt(0);
  let used = 0;
  let keep = 0;
  while (keep < text.length) {
    const next = used + widthOf(text.charAt(keep)) + (keep === 0 ? 0 : kerning(text.charAt(keep - 1), text.charAt(keep)));
    if (next > available) break;
    used = next;
    keep++;
  }
  if (keep === text.length) return text;

  // `used` is the width of the first `keep` characters; the ellipsis needs room too
  while (keep > 0 && used + kerning(text.charAt(keep - 1), ellipsisHead) + ellipsisWidth > available) {
    keep--;
    used -= widthOf(text.charAt(keep)) + (keep === 0 ? 0 : kerning(text.charAt(keep - 1), text.charAt(keep)));
  }
  return keep > 0 || ellipsisWidth <= available ? text.slice(0, keep) + ellipsis : '';
};

/**
 * Cuts `text` to fit `available` pixels, ending in `ellipsis` when something was cut.
 * `widthOf` gives the width of one character, and the text width is the sum of those: cheap, and exact for a
 * monospace font. That is all that runs for text that fits, which is nearly every cell. A cell that does not fit
 * is measured again with `exact.measure` when the sum cannot be trusted, which is for proportional fonts (kerning
 * makes the sum overshoot) and for text with joined scripts such as Arabic (it overshoots by 40%).
 * Characters that form one glyph (emoji, letters with combining accents) are kept or cut together.
 */
const fitText = (
  text: string,
  available: number,
  ellipsis: string,
  widthOf: (character: string) => number,
  exact: ExactFit = { measure: value => sumWidths(toUnits(value), widthOf), sumIsExact: true },
) => {
  const keep = countFitting(text, available, ellipsis, widthOf);
  if (keep === text.length) return text;
  if (exact.sumIsExact && !hasComplexCharacters(text)) return keep < 0 ? '' : text.slice(0, keep) + ellipsis;

  if (exact.kerning && !hasComplexCharacters(text)) return fitKerned(text, available, ellipsis, widthOf, exact.kerning);
  return fitExactly(text, available, ellipsis, widthOf, exact);
};

export default fitText;
