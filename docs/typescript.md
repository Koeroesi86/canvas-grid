# TypeScript

Types ship with the package. Besides the element class (default export) it exports `ColumnHeader`, `ColumnDefinition`, `Transaction`, `CellRenderer`, `CellContext`, `CellState`, `RendererRef`, `LayerOptions`, `SortKey` and `SortDirection`, and registers `canvas-grid` in `HTMLElementTagNameMap`, so `document.querySelector('canvas-grid')` is typed.

> The declarations are single-format. Bundler-style resolution (`moduleResolution: "bundler"`) works; strict Node16 ESM resolution may report the types as CommonJS.
