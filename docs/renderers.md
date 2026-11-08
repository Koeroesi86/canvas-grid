# Custom renderers and layers

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
| `now`, `dt` | Frame timestamp and ms since the previous draw (the grid only draws when something changed, so this can be long) |
| `valueChanged` | The formatted value differs from what was drawn last time |
| `forced` | Everything is being redrawn (first draw, resize, scrolling) |
| `isScrolling` | The grid is being scrolled |
| `state` | Object that persists per cell between frames, for your own bookkeeping. Kept for the 2048 most recently drawn rows, so it resets for a row that was scrolled far away |

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
