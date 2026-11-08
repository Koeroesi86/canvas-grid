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
| `forceDraw()` | Clears and redraws everything |
| `registerRenderer(name, renderer)` | Makes a [renderer](renderers.md) available to columns by name; an existing name is replaced |
| `unregisterRenderer(name)` | Removes a registered renderer |
| `addLayer(name, { alpha, before })` | Adds a canvas on top of the others (or below the layer named in `before`) |
| `removeLayer(name)` / `getLayer(name)` | Removes / looks up a layer (`{ name, canvas, ctx }`) |

Updates are throttled (50 ms) and changed cells flash for `flashInDuration + flashOutDuration`.


## Properties

| Property | Default | Description |
| --- | --- | --- |
| `font` | `'12px monospace'` | Cell font (CSS font shorthand) |
| `headerFont` | `'13px monospace'` | Header font |
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
