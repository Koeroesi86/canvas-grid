# TypeScript

Types ship with the package. Besides the element class (default export) it exports `ColumnHeader`, `ColumnDefinition`, `ColumnState`, `ColumnResizeDetail`, `ColumnResizeSource`, `RowResizeDetail`, `RowResizeSource`, `Transaction`, `CellRenderer`, `CellContext`, `CellState`, `RendererRef`, `LayerOptions`, `SortKey`, `SortDirection`, `SelectionMode`, `SelectionLevel`, `CellRange`, `CellPosition`, `GridSelection`, `SelectionChangeDetail` and `CellFocusDetail`, and registers `canvas-grid` in `HTMLElementTagNameMap` and `HTMLElementEventMap` (the `columnresizing`, `columnresized`, `rowresizing`, `rowresized`, `selectionchange` and `cellfocus` events), so `document.querySelector('canvas-grid')` is typed.

> The declarations are single-format. Bundler-style resolution (`moduleResolution: "bundler"`) works; strict Node16 ESM resolution may report the types as CommonJS.
