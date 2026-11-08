# Getting started

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

## Browser support

Modern evergreen browsers with Custom Elements v1 and Canvas 2D.
