# API reference

## Data model

| Concept | Shape |
| --- | --- |
| Row | `{ id: string \| number, [column: string]: unknown }`. `id` identifies the row (see `getRowId`) |
| Column | `string \| number` (used as both id and header text), or an object (below) |

Column object fields (`ColumnDefinition`):

| Field | Default | Description |
| --- | --- | --- |
| `id` | required | Key of the row property shown in this column |
| `displayName` | – | Header text. Not derived from `id` for object columns |
| `width` | `100` | Column width in px |
| `valueFormatter` | `String(value)` | Converts the raw value to the displayed string. Runs lazily, only for cells being drawn, and again only when the cell's value changes |
| `renderers` | grid's `cellRenderers` | Renderers drawing a cell of this column, in order. Names of [registered renderers](renderers.md) or renderer objects |
| `font` | grid `font` | CSS font of this column's cells, e.g. `'600 12px Menlo, monospace'`. Widths are measured per font, so mixing fonts costs nothing extra while drawing. Keep it within the row height (`cellHeight`); it is not `'inherit'`, which belongs to the grid's `font` |
| `headerFont` | grid `headerFont` | CSS font of this column's header |
| `headerRenderer` | `'header'` | Renderer drawing this column's header (name or object) |

## Methods

| Method | Description |
| --- | --- |
| `setColumns(columns)` | Replaces the column set |
| `setValues(rows)` | Replaces all rows. Pending updates are discarded |
| `queueUpdate(row)` | Adds or updates a row (merged by `id`); only the given columns change |
| `queueRemove(row)` | Removes the row with the same `id` |
| `transaction({ add, update, remove })` | Batch form of the above |
| `getRowData(id)` | `{ id, index, height, values }` for a row (`index` is its displayed position, `values` the raw values by column id), or `undefined` |
| `setSortModel(keys)` / `getSortModel()` | Orders the rows, see [Sorting](sorting.md). An empty list restores the original order |
| `refreshFonts()` | Re-reads inherited fonts and redraws. Call it after changing the CSS font while `font` / `headerFont` are `'inherit'`; loading web fonts does it automatically |
| `forceDraw()` | Clears and redraws everything |
| `registerRenderer(name, renderer)` | Makes a [renderer](renderers.md) available to columns by name; an existing name is replaced |
| `unregisterRenderer(name)` | Removes a registered renderer |
| `addLayer(name, { alpha, desynchronized, before })` | Adds a canvas on top of the others (or below the layer named in `before`); `desynchronized` opts into low-latency presentation, which may tear |
| `removeLayer(name)` / `getLayer(name)` | Removes / looks up a layer (`{ name, canvas, ctx }`) |

Updates are throttled (50 ms) and changed cells flash for `flashInDuration + flashOutDuration`, easing in and out. With `prefers-reduced-motion: reduce` the flash is a steady highlight for the same time. Odd rows are drawn slightly lighter.


## Properties

| Property | Default | Description |
| --- | --- | --- |
| `font` | `'12px monospace'` | Cell font (CSS font shorthand), or `'inherit'` to use the grid element's computed CSS font |
| `headerFont` | `'13px monospace'` | Header font, `'inherit'` works as for `font` |
| `textRendering` | `'auto'` | Canvas `textRendering` for cells and headers: `'optimizeSpeed'`, `'optimizeLegibility'` or `'geometricPrecision'` |
| `fontKerning` | `'auto'` | Canvas `fontKerning`: `'normal'` or `'none'` |
| `letterSpacing` | `'0px'` | Extra space after each character, a CSS length |
| `direction` | `'ltr'` | `'rtl'`, or `'auto'` to pick the direction per cell from its first letter. Right-to-left text is aligned to the right of the cell, and an ellipsis ends it on the left |
| `getRowId` | `(row) => row.id` | Derives the row id; assign your own to key rows differently |
| `showHeaders` | `true` | Show the header row |
| `showRowNumbers` | `true` | Show the row-number column |
| `rowNumbersWidth` | `30` | Width of the row-number column |
| `headerHeight` | `30` | Header row height |
| `cellHeight` | `20` | Row height. Set it before `setValues`, it applies to rows as they are created |
| `fps` | `30` | Maximum redraw rate |
| `cellRenderers` | `['background', 'value']` | Renderers used by columns without their own `renderers` |
| `flashInDuration` | `200` | Fade-in of the update flash in ms |
| `flashOutDuration` | `400` | Fade-out of the update flash in ms |

## Text

Text is laid out with the browser's own canvas text engine, in the cell's padded box and vertically centred. Positions snap to device pixels, so it stays sharp at fractional zoom. A cell is cut with an ellipsis only when it really does not fit: widths are summed per character (cheap, exact for monospace fonts), and only cells that do not fit by that sum are measured as a whole string, so kerning, ligatures and joined scripts such as Arabic are accounted for. Characters that form one glyph (emoji, combining accents, Indic and Thai vowel signs, conjoining Hangul jamo) are never cut apart; where a cluster ends is decided by the browser's `Intl.Segmenter`. The style properties above are applied only when you set them; browsers without support for one of them ignore it.
