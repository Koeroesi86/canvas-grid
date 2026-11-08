# Canvas Grid

[![CI](https://github.com/Koeroesi86/canvas-grid/actions/workflows/ci.yml/badge.svg)](https://github.com/Koeroesi86/canvas-grid/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@koeroesi86/canvas-grid)](https://www.npmjs.com/package/@koeroesi86/canvas-grid)

A fast data grid rendered on `<canvas>`, shipped as a framework-agnostic custom element (`<canvas-grid>`). It virtualises rows and columns, flashes cells when their values change, and is built for streams of frequent updates.

- Plain web component: no framework required, works with React, Vue, Angular or vanilla JS
- Written in TypeScript, types included
- Optional AG Grid-style adapter (`agApi`) for `setRowData` / `updateRowData` / `setColumnDefs`

## Install

```sh
npm install @koeroesi86/canvas-grid
```

Importing the package registers the `<canvas-grid>` element:

```ts
import '@koeroesi86/canvas-grid';
```

Or use the UMD build from a script tag (exposes `window.CanvasGrid`):

```html
<script src="https://unpkg.com/@koeroesi86/canvas-grid/build/web-component.js"></script>
```

## Usage

The element draws into its own box, so give it a size:

```html
<style>
  canvas-grid { display: block; width: 100%; height: 400px; }
</style>
<canvas-grid></canvas-grid>
```

```ts
import '@koeroesi86/canvas-grid';

const grid = document.querySelector('canvas-grid')!; // typed as CanvasGridComponent

grid.font = '12px "Roboto", sans-serif';

grid.setColumns([
  'name',                                        // shorthand: id and header text
  { id: 'price', displayName: 'Price', width: 80, valueFormatter: v => Number(v).toFixed(2) },
]);

grid.setValues([
  { id: 1, name: 'Apple', price: 1.2 },
  { id: 2, name: 'Pear', price: 0.9 },
]);

// later: update single rows (batched and throttled internally)
grid.queueUpdate({ id: 2, price: 1.0 });
```

Before `setColumns` is called, the grid shows 50 numeric placeholder columns.

## API

### Data model

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
| `valueFormatter` | `String(value)` | Converts the raw value to the displayed string |
| `renderers` | grid's `cellRenderers` | Renderers drawing a cell of this column, in order. Names of [registered renderers](#custom-renderers-and-layers) or renderer objects |
| `headerRenderer` | `'header'` | Renderer drawing this column's header (name or object) |

### Methods

| Method | Description |
| --- | --- |
| `setColumns(columns)` | Replaces the column set |
| `setValues(rows)` | Replaces all rows. Pending updates are discarded |
| `queueUpdate(row)` | Adds or updates a row (merged by `id`); only the given columns change |
| `queueRemove(row)` | Removes the row with the same `id` |
| `transaction({ add, update, remove })` | Batch form of the above |
| `getRowData(id)` | Returns the internal row record |
| `forceDraw()` | Clears and redraws everything |
| `registerRenderer(name, renderer)` | Makes a [renderer](#custom-renderers-and-layers) available to columns by name; an existing name is replaced |
| `unregisterRenderer(name)` | Removes a registered renderer |
| `addLayer(name, { alpha, before })` | Adds a canvas on top of the others (or below the layer named in `before`) |
| `removeLayer(name)` / `getLayer(name)` | Removes / looks up a layer (`{ name, canvas, ctx }`) |

Updates are throttled (50 ms) and changed cells flash for `flashInDuration + flashOutDuration`.

### Properties

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

### Custom renderers and layers

The grid draws onto stacked canvases called layers: `background`, `content` and `header` out of the box. A renderer draws into one layer and is registered under a name; columns select renderers by name. The built-in ones are `'background'` (fill, borders and the update flash), `'value'` (the text) and `'header'`.

```ts
grid.addLayer('badges'); // on top of the existing layers

grid.registerRenderer('badge', {
  layer: 'badges',
  draw({ ctx, x, y, width, formatted }) {
    ctx.fillStyle = formatted === 'sold out' ? '#c33' : '#3a3';
    ctx.fillRect(x + width - 8, y + 4, 4, 4);
  },
});

grid.setColumns([
  { id: 'status', renderers: ['background', 'value', 'badge'] },
]);
```

A renderer is an object:

| Member | Description |
| --- | --- |
| `layer` | Name of the layer its `ctx` belongs to |
| `draw(cell)` | Draws one cell, header or row number |
| `isAnimating?(cell)` | Return `true` while the cell is animating. Cells are only redrawn when something changed (value, scroll, resize) or while a renderer reports animation, plus once after it stops |
| `clearCache?()` | Called when web fonts finish loading |

`cell` (`CellContext`) is one object reused for every cell, so read what you need while drawing and do not keep a reference to it:

| Field | Description |
| --- | --- |
| `ctx` | Context of the renderer's layer |
| `x`, `y`, `width`, `height` | Cell rectangle in canvas pixels |
| `row`, `column` | `{ id, index }` of the row and the column header; `row` is undefined for headers, `column` for row numbers |
| `value`, `formatted` | Raw value and the string after the column's `valueFormatter` |
| `updatedAt`, `age` | When the value last changed, and ms since then (`Infinity` if it never did) |
| `now`, `dt` | Frame timestamp and ms since the previous frame |
| `valueChanged` | The formatted value differs from what was drawn last time |
| `forced` | Everything is being redrawn (first draw, resize, scrolling) |
| `isScrolling` | The grid is being scrolled |
| `state` | Object that persists per cell between frames, for your own bookkeeping |

A renderer that animates, for example a pulse that lasts one second after a change:

```ts
grid.registerRenderer('pulse', {
  layer: 'badges',
  isAnimating: ({ age }) => age < 1000,
  draw({ ctx, x, y, width, height, age }) {
    ctx.clearRect(x, y, width, height);
    if (age >= 1000) return;
    ctx.globalAlpha = 1 - age / 1000;
    ctx.fillStyle = '#39f';
    ctx.fillRect(x, y, width, height);
    ctx.globalAlpha = 1;
  },
});
```

> `cellRenderer(value, x, y, ...)` and `headerRenderer(header, x)` with positional arguments were replaced by the renderer objects above.

### AG Grid-style adapter

`grid.agApi` mirrors a small part of AG Grid's API for easier migration:

```ts
grid.agApi.setColumnDefs(columns);
grid.agApi.setRowData(rows);
grid.agApi.updateRowData({ add: [], update: [], remove: [] });
grid.agApi.getRowNodeId = row => row.key;
```

### TypeScript

Types ship with the package. Besides the element class (default export) it exports `ColumnHeader`, `ColumnDefinition`, `Transaction`, `CellRenderer`, `CellContext`, `CellState`, `RendererRef` and `LayerOptions`, and registers `canvas-grid` in `HTMLElementTagNameMap`, so `document.querySelector('canvas-grid')` is typed.

> The declarations are single-format. Bundler-style resolution (`moduleResolution: "bundler"`) works; strict Node16 ESM resolution may report the types as CommonJS.

## Browser support

Modern evergreen browsers with Custom Elements v1 and Canvas 2D.

## Development

Requires Node.js 22.18+ (the Node-side scripts are TypeScript run through Node's native type stripping).

```sh
npm ci
npm run dev          # Vite dev server with a random-data websocket source, http://localhost:3000
npm run build        # type-check, then bundle (UMD + ESM) and emit declarations into build/
npm test             # type-check, release-script tests and data store unit tests
npm run bench        # data store benchmarks (BENCH_ROWS=1000,1000000 to change sizes)
npm run bench:scroll # scroll FPS and frame-time p95 in headless Chromium (needs `npx playwright install chromium`)
npm run serve-local  # run only the example data server
```

`DEV_PORT` (env or `.env`) changes the dev port.

Releases are published to npm from CI when a `vX.Y.Z` tag is pushed (see `.github/workflows/publish.yml`).

Pull requests also run the scroll benchmark against the base commit in CI (`.github/workflows/benchmark.yml`): base and head alternate three times on the same runner, and the job summary shows the median change. It fails on a regression of more than 30% in FPS or p95 frame time. Locally: `node scripts/compare-benchmarks.mts <path-to-base-checkout>`.

## Security

See [SECURITY.md](.github/SECURITY.md).

## License

[MIT](LICENSE)
