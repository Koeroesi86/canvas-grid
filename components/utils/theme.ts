export type ThemeName = 'light' | 'dark';

/** Everything the grid takes from CSS; colours and fonts are CSS values, sizes are px. */
export interface Theme {
  background: string;
  text: string;
  font: string;
  rowHeight: number;
  /** Right and bottom edge of body cells. */
  border: string;
  headerBackground: string;
  headerText: string;
  headerFont: string;
  headerHeight: number;
  headerBorder: string;
  headerBottomBorder: string;
  /** Header of a column or row number with some of its cells selected. */
  headerSelected: string;
  /** Header of a column or row number with all its cells selected. */
  headerFullySelected: string;
  /** Laid over odd rows; usually translucent. */
  zebra: string;
  /** Laid over the row under the pointer; usually translucent. */
  hover: string;
  /** Laid over a cell that just changed, at the strength of the flash. */
  flash: string;
  selection: string;
  selectionBorder: string;
}

type ThemeKey = keyof Theme;

/** The CSS custom property of each themed value. */
export const THEME_TOKENS: Readonly<Record<ThemeKey, string>> = {
  background: '--cg-background',
  text: '--cg-text-color',
  font: '--cg-font',
  rowHeight: '--cg-row-height',
  border: '--cg-border-color',
  headerBackground: '--cg-header-background',
  headerText: '--cg-header-text-color',
  headerFont: '--cg-header-font',
  headerHeight: '--cg-header-height',
  headerBorder: '--cg-header-border-color',
  headerBottomBorder: '--cg-header-bottom-border-color',
  headerSelected: '--cg-header-selected-background',
  headerFullySelected: '--cg-header-fully-selected-background',
  zebra: '--cg-zebra-color',
  hover: '--cg-hover-color',
  flash: '--cg-flash-color',
  selection: '--cg-selection-color',
  selectionBorder: '--cg-selection-border-color',
};

const shared = {
  font: '12px sans-serif',
  rowHeight: 20,
  headerFont: '13px sans-serif',
  headerHeight: 30,
  flash: 'rgb(214, 144, 13)',
};

export const THEME_DEFAULTS: Readonly<Record<ThemeName, Readonly<Theme>>> = {
  dark: {
    ...shared,
    background: '#333',
    text: '#efefef',
    border: '#3b3b3b',
    headerBackground: '#262626',
    headerText: '#efefef',
    headerBorder: '#333',
    headerBottomBorder: '#4a4a4a',
    headerSelected: '#2f3d4a',
    headerFullySelected: '#3a5a7c',
    zebra: 'rgba(255, 255, 255, 0.025)',
    hover: 'rgba(255, 255, 255, 0.06)',
    selection: 'rgba(74, 144, 217, 0.25)',
    selectionBorder: '#4a90d9',
  },
  light: {
    ...shared,
    background: '#fff',
    text: '#1f2328',
    border: '#e4e7eb',
    headerBackground: '#f3f4f6',
    headerText: '#1f2328',
    headerBorder: '#e4e7eb',
    headerBottomBorder: '#c9ced6',
    headerSelected: '#dbe8f6',
    headerFullySelected: '#b9d3ee',
    zebra: 'rgba(0, 0, 0, 0.025)',
    hover: 'rgba(0, 0, 0, 0.05)',
    selection: 'rgba(74, 144, 217, 0.2)',
    selectionBorder: '#2f6fb5',
  },
};

/** What the CSS side of a theme is read through; the browser provides it, tests fake it. */
export interface ThemeSource {
  /** The value of a custom property, or an empty string when it is not set. */
  read: (token: string) => string;
  isColor: (value: string) => boolean;
  isFont: (value: string) => boolean;
}

const PIXEL_KEYS: readonly ThemeKey[] = ['rowHeight', 'headerHeight'];
const FONT_KEYS: readonly ThemeKey[] = ['font', 'headerFont'];

const toPixels = (value: string) => {
  const pixels = /^\d+(\.\d+)?(px)?$/.test(value) ? parseFloat(value) : NaN;
  return pixels > 0 ? pixels : undefined;
};

/** Each value from its custom property, or from the defaults of `name` when it is missing or invalid. */
export const readTheme = (name: ThemeName, { read, isColor, isFont }: ThemeSource): Theme => {
  const defaults = THEME_DEFAULTS[name];
  const parse = (key: ThemeKey, value: string): string | number | undefined => {
    if (!value) return undefined;
    if (PIXEL_KEYS.includes(key)) return toPixels(value);
    if (FONT_KEYS.includes(key)) return isFont(value) ? value : undefined;
    return isColor(value) ? value : undefined;
  };

  return Object.fromEntries(
    (Object.keys(THEME_TOKENS) as ThemeKey[]).map(key => [key, parse(key, read(THEME_TOKENS[key]).trim()) ?? defaults[key]]),
  ) as unknown as Theme;
};

export const isSameTheme = (a: Theme, b: Theme) => (Object.keys(THEME_TOKENS) as ThemeKey[]).every(key => a[key] === b[key]);

/** `fillStyle` ignores colours it cannot parse, so a colour is valid when it sticks whichever value it replaces. */
export const createColorCheck = (ctx: Pick<CanvasRenderingContext2D, 'fillStyle'>) => (value: string) => {
  ctx.fillStyle = '#000000';
  ctx.fillStyle = value;
  const onBlack = ctx.fillStyle;
  ctx.fillStyle = '#ffffff';
  ctx.fillStyle = value;
  return onBlack === ctx.fillStyle;
};

export const isCssFont = (value: string) => typeof CSS === 'undefined' || CSS.supports('font', value);
