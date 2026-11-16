# Selection

Selecting is off by default. Turn it on with `selectionMode`:

```js
grid.selectionMode = 'range';
grid.addEventListener('selectionchange', ({ detail }) => console.log(detail.ranges, detail.active));
```

| Mode | A click selects | Dragging or shift+click selects |
| --- | --- | --- |
| `'none'` (default) | nothing | nothing |
| `'cell'` | the cell | nothing: one cell at a time |
| `'range'` | the cell | a block of cells, like a spreadsheet |
| `'row'` | the whole row of the cell | whole rows |
| `'column'` | the whole column of the cell | whole columns |

`getSelection`, `setSelection` and `clearSelection` work in every mode; the mode only decides what the user can do. Switching to `'none'` clears the selection.

## Pointer

- **Click** a cell: it becomes the active cell and the only selection
- **Shift+click** extends from the active cell to the clicked one, replacing the other ranges
- **Ctrl or cmd+click** adds a range, so non-adjacent cells can be selected. Shift+ctrl+click extends the newest range instead
- **Drag** from a cell to select a block. Dragging past the edge of the grid scrolls it, faster the further the pointer is outside, and the selection follows
- **Click a column header** (modes `'range'` and `'column'`) to select the whole column. Shift+click extends to a range of columns from the active cell's, ctrl or cmd+click adds a column, and dragging across the headers selects several. The active cell becomes the one at the top of the column in view
- **Click a row number** (modes `'range'` and `'row'`) to select the whole row, the same way. The row-number column has to be shown (`showRowNumbers`)
- **Click the corner** (where headers and row numbers meet; every mode but `'cell'`) to select everything. The active cell stays
- **Touch**: a tap selects; a drag still scrolls the grid

Pressing on the border of a header or row number still resizes it, see [resizing](api.md#resizing-columns). Headers do not sort when clicked; sorting is `setSortModel`.

The grid does not scroll on a click, only while dragging. Dragging along the headers scrolls sideways only, and along the row numbers vertically only.

## Model

A selection is a list of **ranges** and one **active cell**. A range names its rows and columns by displayed position, both ends included:

```js
grid.setSelection([
  { rows: [2, 5], columns: [0, 1] }, // a block
  { columns: [3, 3] },               // all of column 3
  { rows: [10, 10] },                // all of row 10
]);
grid.getSelection(); // { ranges: [...], active: { row: 10, column: 0 } }
```

Leaving `rows` or `columns` out means all of them, not just those that exist now: a whole-column selection keeps covering new rows as they arrive, and selecting everything (`[{}]`) costs the same on a million rows as on ten.

Positions are **displayed positions**, as in a spreadsheet. After [sorting](sorting.md), or when an update moves a row, the same screen cells stay selected, not the same rows. Whole-column selections are not affected by sorting at all. The selection is cut to the data when rows or columns change: ranges that no longer fit are dropped, and an empty grid selects nothing.

The active cell is where keyboard moves start; it is drawn with a border and without the tint, and lies inside the newest range.

## Drawing

Selection has a layer of its own (`selection`, between `content` and `header`), created the first time something is selected, so a grid that never selects carries no extra canvas. Each range is drawn as one tinted rectangle with an outline, however many cells it covers, and the active cell as a thicker border. It is redrawn only when the selection, the scroll position or the layout changes.

Headers and row numbers show what is selected: a column header whose column has some selected cells is drawn with `selectedBackground`, and with `fullySelectedBackground` when the whole column is selected (a whole-column range, or ranges covering every row); row numbers work the same for rows. Both are options of the header renderer; custom header renderers read `cell.selected` (`'none'`, `'partial'` or `'full'`, see [renderers](renderers.md)).

| Property | Default | Description |
| --- | --- | --- |
| `selectionColor` | `'rgba(74, 144, 217, 0.25)'` | Tint of selected cells. Set it, then call `forceDraw()` |
| `selectionBorderColor` | `'#4a90d9'` | Outline of ranges and border of the active cell |

## API

| Member | Description |
| --- | --- |
| `selectionMode` | See the table above |
| `getSelection()` | `{ ranges, active }`: copies of the ranges, and the active cell `{ row, column }` or `undefined` |
| `setSelection(ranges, active?)` | Replaces the selection. `active` defaults to the first cell of the last range; an empty list clears it |
| `clearSelection()` | Selects nothing |

| Event | When | `detail` |
| --- | --- | --- |
| `selectionchange` | The ranges or the active cell changed, also from the API | `{ ranges, active, selecting }`. `selecting` is `true` while the pointer is down, and a final event with `false` follows when it is released |
| `cellfocus` | The active cell moved to another cell | `{ rowId, rowIndex, columnId, columnIndex }` |

Types: `CellRange`, `CellPosition`, `GridSelection`, `SelectionMode`, `SelectionChangeDetail` and `CellFocusDetail`, see [TypeScript](typescript.md).
