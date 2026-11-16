# Editing

A column is editable when it says so. The grid puts a native element (`<input>`, `<select>`) over the cell, so the canvas stays the only renderer and the browser's own text editing, IME and accessibility apply.

```js
grid.setColumns([
  { id: 'name', editable: true },
  { id: 'qty', editable: true, cellEditor: 'number', validator: value => value >= 0 || 'Cannot be negative' },
  { id: 'active', editable: ({ rowId }) => rowId !== 1, cellEditor: 'checkbox' },
  { id: 'status', editable: true, cellEditor: { type: 'select', options: ['open', 'closed'] } },
]);
grid.addEventListener('cellvaluechanged', ({ detail }) => save(detail.rowId, detail.columnId, detail.newValue));
```

## Starting and ending

| Action | Result |
| --- | --- |
| Double-click a cell | Starts editing it |
| F2, or Enter with a single cell selected | Starts editing the active cell (needs a `selectionMode`). With several cells selected Enter keeps [stepping](selection.md#keyboard) through the selection |
| Typing a character on the active cell | Starts editing with that character as the text (text, number and custom editors) |
| Enter / Shift+Enter | Commits, and moves the selection down / up |
| Tab / Shift+Tab | Commits, and moves the selection right / left, continuing on the next row |
| Escape | Cancels; the cell keeps its value |
| Focus leaves the editor (a click elsewhere) | Commits, or cancels when the value is invalid. Switching to another window does neither |

An invalid value cannot be committed with Enter, Tab or `stopEditing`: the editor stays open in its invalid state (`.invalid`, `aria-invalid`, the message as its `title`, outlined in `--cg-invalid-color`).

## Column options

| Option | Description |
| --- | --- |
| `editable` | `true`, or a function `(cell) => boolean` asked each time with `{ rowId, rowIndex, columnId, columnIndex, value }`. Default `false` |
| `cellEditor` | `'text'` (default), `'number'`, `'checkbox'`, `{ type: 'select', options }` (options are strings, numbers or `{ value, label }`), or a function building a custom editor (below) |
| `valueParser` | `(text, change) => value` for the text of the text and number editors; throw to mark it invalid. Defaults to the text itself, and to a number (empty means no value) for `'number'`. Checkbox, select and custom editors give typed values and skip it |
| `validator` | `(value, change) => true \| false \| message`, run on the parsed value while typing and before committing |
| `valueSetter` | `(change) => boolean \| void`, called instead of the grid storing the value, for example to send it to a server and `queueUpdate` the result. Return `false` to reject the edit and keep the editor open |

`change` is `{ rowId, rowIndex, columnId, columnIndex, value, oldValue, newValue }`, `value` and `oldValue` being what the cell holds at that moment.

## Methods, properties and events

| | |
| --- | --- |
| `startEditing(rowId, columnId)` | Opens the editor and scrolls the cell into view. Returns `false` if the cell does not exist or is not `editable`, `celleditstart` was cancelled, or the edit in progress could not be committed |
| `stopEditing(cancel?)` | Commits the edit in progress, or drops it with `cancel`. Returns `false` when none was open, or the value is invalid or rejected |
| `editOutOfView` | What happens when the cell scrolls out of view, or is clipped away: `'cancel'` (default), `'commit'`, or `'keep'`, which hides the editor until the cell is back. An edit also ends (cancelled) when its row or column is removed |
| `celleditstart` | Cancelable; `detail` is the cell `{ rowId, rowIndex, columnId, columnIndex, value }` |
| `cellvaluechanged` | After the value was stored (or handed to `valueSetter`); `detail` adds `oldValue` and `newValue`. Not fired when the value is unchanged |
| `celleditend` | `detail` adds `cancelled` and `newValue` (undefined when cancelled). Fires after `cellvaluechanged` |

The editor follows its cell while the grid scrolls, is resized or re-sorted, and is clipped so it never covers the headers or row numbers.

## Streamed updates

Updates arriving for the cell being edited are stored as usual and flash, but never touch the editor. On commit the edited value wins; when the user changed nothing the cell is left alone, so a streamed value is not overwritten by the one the editor started from. A write from an edit is applied at once, ahead of updates still queued, so a queued update to the same cell can replace it moments later.

## Custom editors

A function receiving `{ rowId, rowIndex, columnId, columnIndex, value, initialText, commit, cancel }` and returning `{ element, getValue, focus?, place?, destroy? }`. `place(visible)` is called each time the grid moves the editor, and with `false` while it is clipped out of sight, for parts outside `element` such as a popup. `element` goes over the cell and is focused (or `focus()` is called), `getValue()` supplies the value, which is validated but not parsed, and `commit()` / `cancel()` let the editor end itself.

```js
const dateEditor = ({ value }) => {
  const input = Object.assign(document.createElement('input'), { type: 'date', value });
  return { element: input, getValue: () => input.value };
};
grid.setColumns([{ id: 'due', editable: true, cellEditor: dateEditor }]);
```
