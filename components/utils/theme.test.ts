import { describe, expect, it } from 'vitest';
import { createColorCheck, isSameTheme, readTheme, THEME_DEFAULTS, THEME_TOKENS } from './theme';
import type { ThemeSource } from './theme';

const source = (values: Record<string, string>, overrides: Partial<ThemeSource> = {}): ThemeSource => ({
  read: token => values[token] ?? '',
  isColor: value => !value.startsWith('bad'),
  isFont: value => !value.startsWith('bad'),
  ...overrides,
});

describe('readTheme', () => {
  it('uses the defaults of the theme when nothing is set', () => {
    expect(readTheme('dark', source({}))).toEqual(THEME_DEFAULTS.dark);
    expect(readTheme('light', source({}))).toEqual(THEME_DEFAULTS.light);
  });

  it('prefers custom properties over the defaults', () => {
    const theme = readTheme('light', source({ [THEME_TOKENS.background]: ' #123456 ', [THEME_TOKENS.font]: '14px Inter' }));
    expect(theme.background).toBe('#123456');
    expect(theme.font).toBe('14px Inter');
    expect(theme.text).toBe(THEME_DEFAULTS.light.text);
  });

  it('reads sizes in px, with or without the unit', () => {
    const theme = readTheme('dark', source({ [THEME_TOKENS.rowHeight]: '28px', [THEME_TOKENS.headerHeight]: '36' }));
    expect(theme.rowHeight).toBe(28);
    expect(theme.headerHeight).toBe(36);
  });

  it('falls back for invalid values', () => {
    const theme = readTheme(
      'dark',
      source({
        [THEME_TOKENS.rowHeight]: '2rem',
        [THEME_TOKENS.headerHeight]: '0',
        [THEME_TOKENS.background]: 'bad-colour',
        [THEME_TOKENS.font]: 'bad-font',
      }),
    );
    expect(theme).toEqual(THEME_DEFAULTS.dark);
  });
});

describe('isSameTheme', () => {
  it('compares every value', () => {
    expect(isSameTheme(THEME_DEFAULTS.dark, { ...THEME_DEFAULTS.dark })).toBe(true);
    expect(isSameTheme(THEME_DEFAULTS.dark, { ...THEME_DEFAULTS.dark, hover: 'red' })).toBe(false);
    expect(isSameTheme(THEME_DEFAULTS.dark, THEME_DEFAULTS.light)).toBe(false);
  });
});

describe('createColorCheck', () => {
  // keeps the previous colour when it gets an invalid one, like a canvas does
  const fakeContext = () => {
    let current = '#000000';
    return {
      get fillStyle() {
        return current;
      },
      set fillStyle(value: string) {
        if (value.startsWith('#') || value === 'red') current = value;
      },
    };
  };

  it('accepts colours the canvas parses, black included', () => {
    const isColor = createColorCheck(fakeContext());
    expect(isColor('red')).toBe(true);
    expect(isColor('#000000')).toBe(true);
  });

  it('rejects what it ignores', () => {
    expect(createColorCheck(fakeContext())('nonsense')).toBe(false);
  });
});
