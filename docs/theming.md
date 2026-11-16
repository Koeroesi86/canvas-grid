# Theming

The grid is themed from CSS custom properties, with a light and a dark theme.

```css
canvas-grid {
  --cg-background: #fffdf5;
  --cg-row-height: 28px;
}
```

## Light and dark

The grid follows `prefers-color-scheme`: the light theme when the page prefers light, the dark theme otherwise. Set the `theme` attribute to `light` or `dark` to pin one, for example on a page that is dark only:

```html
<canvas-grid theme="dark"></canvas-grid>
```

Custom properties you set win over the defaults of either theme, so a page can restyle just a few values or bring a whole palette (scoped to a class or to `@media (prefers-color-scheme: dark)`, as usual).

## Tokens

Set them on `canvas-grid` or on any ancestor; they are inherited. Colours are any CSS colour, fonts are a CSS `font` shorthand (`inherit` works as for the `font` property), sizes are px (`28px` or `28`). A missing or invalid value falls back to the default of the active theme.

| Token | Dark | Light | Used for |
| --- | --- | --- | --- |
| `--cg-background` | `#333` | `#fff` | Cell background |
| `--cg-text-color` | `#efefef` | `#1f2328` | Cell text |
| `--cg-font` | `12px sans-serif` | same | Cell font |
| `--cg-row-height` | `20px` | same | Row height |
| `--cg-border-color` | `#3b3b3b` | `#e4e7eb` | Right and bottom edge of cells |
| `--cg-header-background` | `#262626` | `#f3f4f6` | Header and the corner above the row numbers |
| `--cg-header-text-color` | `#efefef` | `#1f2328` | Header text and sort arrow |
| `--cg-header-font` | `13px sans-serif` | same | Header font |
| `--cg-header-height` | `30px` | same | Header height |
| `--cg-header-border-color` | `#333` | `#e4e7eb` | Right edge of headers |
| `--cg-header-bottom-border-color` | `#4a4a4a` | `#c9ced6` | Edge between the header and the body |
| `--cg-header-selected-background` | `#2f3d4a` | `#dbe8f6` | Header with some of its cells selected |
| `--cg-header-fully-selected-background` | `#3a5a7c` | `#b9d3ee` | Header with all its cells selected |
| `--cg-zebra-color` | `rgba(255, 255, 255, 0.025)` | `rgba(0, 0, 0, 0.025)` | Laid over odd rows |
| `--cg-hover-color` | `rgba(255, 255, 255, 0.06)` | `rgba(0, 0, 0, 0.05)` | Laid over the row under the pointer |
| `--cg-flash-color` | `rgb(214, 144, 13)` | same | Laid over a cell that just changed; fades with the flash |
| `--cg-selection-color` | `rgba(74, 144, 217, 0.25)` | `rgba(74, 144, 217, 0.2)` | Tint of selected cells |
| `--cg-selection-border-color` | `#4a90d9` | `#2f6fb5` | Outline of a selection and the active cell |
| `--cg-scrollbar-color` | `#555` | `#b4bac2` | Scrollbar thumb (plain CSS, not read by the grid) |
| `--cg-invalid-color` | `#d9534f` | same | Outline of a cell editor holding an invalid value (plain CSS, not read by the grid). The editor also uses `--cg-background`, `--cg-text-color` and `--cg-selection-border-color` |

The zebra, hover and selection colours are drawn over the background, so keep them translucent.

## Changing the theme

The tokens are read when the grid is attached and again when something that can change them does:

- the colour scheme of the page changes (`prefers-color-scheme`)
- the `theme`, `class`, `style` or `data-theme` attribute of the grid or of an ancestor changes
- `refreshTheme()` is called, for changes the grid cannot see, such as toggling a stylesheet

When a value changed, the grid redraws; there is no reload. Reading happens outside the draw path, so scrolling and updates cost the same as before. A change to row or header height re-lays out the rows.

## Options win over tokens

The options that existed before keep working and win over the tokens when set: `font`, `headerFont`, `cellHeight` (and `setRowHeight`), `headerHeight`, `textColor` (cell and header text), `backgroundColor`, `headerBackgroundColor`, `selectionColor` and `selectionBorderColor`. Setting one to `undefined` hands it back to the theme. The theme getters (`font`, `textColor`, ...) return the value in effect.
