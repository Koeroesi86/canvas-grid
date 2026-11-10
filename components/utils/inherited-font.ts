export const INHERIT_FONT = 'inherit';

type FontStyle = Pick<CSSStyleDeclaration, 'fontStyle' | 'fontWeight' | 'fontSize' | 'fontFamily'>;

/**
 * The element's computed font as a canvas font string, or `fallback` when it has none (not attached yet).
 * Built from the longhands, because `getComputedStyle(...).font` is empty in some browsers.
 */
export const resolveFont = (font: string, style: FontStyle, fallback: string) => {
  if (font !== INHERIT_FONT) return font;
  if (!style.fontSize || !style.fontFamily) return fallback;
  return [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].filter(Boolean).join(' ');
};
