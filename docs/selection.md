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

## Keyboard

Clicking a cell gives the grid keyboard focus; a grid with a `selectionMode` takes `tabindex="0"` unless the page set one, and one without stays out of the tab order. The grid scrolls to keep the active cell in view.

| Keys | Action |
| --- | --- |
| Arrows | Move the active cell and select only it (whole rows or columns in `'row'` and `'column'` mode). With nothing selected, the first press selects the cell at the top left of the view |
| Shift+arrows | Extend the newest range from the active cell. A range of whole columns or rows keeps being one, and only grows along its own direction |
| Ctrl/Cmd+arrows | Jump to the edge of the grid; with Shift, extend to it |
| Home / End | First / last column of the row. With Ctrl/Cmd: the first / last cell |
| PageUp / PageDown | Move a screen of rows (shift extends) |
| Ctrl/Cmd+A | Select everything (not in `'cell'` mode) |
| Ctrl/Cmd+Space / Shift+Space | Select the column / row of the active cell |
| Enter / Shift+Enter | Move the active cell down / up inside the selection, continuing on the next column and wrapping at the end. With one cell selected, move the selection |
| Tab / Shift+Tab | The same across and back. With one cell selected they are left to the browser, so the grid never traps keyboard focus |
| Escape | Collapse the selection to the active cell |
| F2, typing, Enter on one cell | Start [editing](editing.md) the active cell, when its column is `editable`. Without one, Enter keeps moving the selection |

Keys the page already handled (`defaultPrevented`) and Alt combinations are ignored.

## Clipboard

Ctrl/Cmd+C (or Edit > Copy) with the grid focused copies the newest range as tab-separated text, a row per line, with the cells' **formatted** values, as they are shown (`valueFormatter` applied; sorting, by contrast, uses raw values). Fields holding a tab, a line break or a quote are wrapped in quotes with the quotes doubled, so spreadsheets paste it into cells correctly. Headers and row numbers are not copied. Other ranges of a multi-range selection are left out. This uses the browser's `copy` event, so it works without the async clipboard API or any permission.

A range holds at most 1,000,000 cells per copy; whole rows beyond that are left off and `truncated` is `true`. Nothing is copied when nothing is selected or the mode is `'none'`, and the browser's own copy takes over.

The cancelable `selectioncopy` event fires first, with the text in `detail`: change `detail.text` to put something else on the clipboard, or call `preventDefault()` to copy nothing.

```js
grid.addEventListener('selectioncopy', ({ detail }) => {
  detail.text = detail.text.replaceAll('\t', ',');  // comma-separated instead
});
```

## Context menu

With a `selectionMode` other than `'none'`, a right click, a long press, the menu key or Shift+F10 opens the grid's own menu instead of the browser's. It holds two entries: **Edit**, which opens the [editor](editing.md) on the cell under the pointer (greyed out when that cell isn't editable, or the menu was opened over a header), and **Copy**, which calls `copySelection()`, so `selectioncopy` applies to it too. The menu is plain HTML (`role="menu"` with `menuitem` buttons) in the top layer, so it is not clipped by the grid, and it closes on Escape, an outside click, scrolling or picking an entry. Arrow keys, Home and End move through the entries and Enter picks one.

A right click inside the selection keeps it; elsewhere it first selects what was clicked: the cell, or the whole column or row for a header or row number. The keyboard opens the menu at the active cell.

The cancelable `gridcontextmenu` event fires first. `detail.items` is a copy of `contextMenuItems`: change it to add, remove or reorder entries for this opening, or call `preventDefault()` to show no menu (or your own). Set `contextMenuItems` to `[]` to keep the browser's menu.

```js
grid.contextMenuItems = [
  ...grid.contextMenuItems,
  { id: 'clear', label: 'Clear selection', run: () => grid.clearSelection() },
];

grid.addEventListener('gridcontextmenu', ({ detail }) => {
  // detail.row / detail.column: the cell under the pointer; detail.ranges: the selection
  if (detail.column === 0) detail.items = detail.items.filter(item => item.id !== 'copy');
});
```

Entries are `{ id, label, disabled?, run(detail) }`; `disabled` is a boolean or a function of the detail, asked each time the menu opens. The menu follows the page's colours through the CSS variables `--canvas-grid-menu-background`, `--canvas-grid-menu-color`, `--canvas-grid-menu-border` and `--canvas-grid-menu-hover`.

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
| `copySelection()` | Copies the newest range as the copy shortcut does, `selectioncopy` included. Resolves to whether anything was copied; browsers allow it from a user action only |
| `contextMenuItems` | The entries of the [context menu](#context-menu) |

| Event | When | `detail` |
| --- | --- | --- |
| `selectionchange` | The ranges or the active cell changed, also from the API | `{ ranges, active, selecting }`. `selecting` is `true` while the pointer is down, and a final event with `false` follows when it is released |
| `cellfocus` | The active cell moved to another cell | `{ rowId, rowIndex, columnId, columnIndex }` |
| `selectioncopy` | The user copies, before anything goes to the clipboard. Cancelable | `{ text, range, truncated }`; see [Clipboard](#clipboard) |
| `gridcontextmenu` | The context menu is about to open. Cancelable | `{ ranges, active, x, y, row, column, items }`; see [Context menu](#context-menu) |

Types: `CellRange`, `CellPosition`, `GridSelection`, `SelectionMode`, `SelectionChangeDetail`, `SelectionCopyDetail`, `CellFocusDetail`, `ContextMenuItem` and `ContextMenuDetail`, see [TypeScript](typescript.md).
