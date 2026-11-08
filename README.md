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
| `cellRenderer` | built-in | Custom cell drawing function |
| `headerRenderer` | built-in | Custom header drawing function |

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

### AG Grid-style adapter

`grid.agApi` mirrors a small part of AG Grid's API for easier migration:

```ts
grid.agApi.setColumnDefs(columns);
grid.agApi.setRowData(rows);
grid.agApi.updateRowData({ add: [], update: [], remove: [] });
grid.agApi.getRowNodeId = row => row.key;
```

### TypeScript

Types ship with the package. Besides the element class (default export) it exports `ColumnHeader`, `ColumnDefinition` and `Transaction`, and registers `canvas-grid` in `HTMLElementTagNameMap`, so `document.querySelector('canvas-grid')` is typed.

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
npm run serve-local  # run only the example data server
```

`DEV_PORT` (env or `.env`) changes the dev port.

Releases are published to npm from CI when a `vX.Y.Z` tag is pushed (see `.github/workflows/publish.yml`).

## Security

See [SECURITY.md](.github/SECURITY.md).

## License

[MIT](LICENSE)
