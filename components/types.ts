export type Key = string | number;

export type RowId = Key;

export interface RowInput {
  id: RowId;
  [column: string]: unknown;
}

/** A row's position and size; its values live in the column stores, addressed by `slot`. */
export interface RowData {
  id: RowId;
  /** Position in the displayed (sorted) order. */
  index: number;
  /** Position in the column stores; stable until rows are removed. */
  slot: number;
  height: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SortKey {
  columnId: Key;
  direction?: SortDirection;
  /** Orders two values of the column; defaults to numbers numerically, then text, with empty values last. */
  compare?: (a: unknown, b: unknown) => number;
}

/** A cell by displayed position: zero-based row and column indexes. */
export interface CellPosition {
  row: number;
  column: number;
}

/** First and last index of a run of rows or columns, both inclusive. */
export type Span = readonly [first: number, last: number];

/** A block of cells. Leaving `rows` or `columns` out means all of them, now and as rows are added. */
export interface CellRange {
  rows?: Span;
  columns?: Span;
}

/** What `getSelection` returns and `setSelection` takes: the selected ranges, and the cell that has focus. */
export interface GridSelection {
  ranges: CellRange[];
  active: CellPosition | undefined;
}

/** How much of a column or row is selected: none of it, some of it, or all of it. */
export type SelectionLevel = 'none' | 'partial' | 'full';

/** How the user can select: not at all, one cell, ranges of cells (Excel-style), whole rows or whole columns. */
export type SelectionMode = 'none' | 'cell' | 'range' | 'row' | 'column';

export interface SelectionChangeDetail extends GridSelection {
  /** True while the pointer is down and the selection is being dragged out; a final event with `false` follows. */
  selecting: boolean;
}

/** One entry of the grid's context menu. */
export interface ContextMenuItem {
  id: string;
  label: string;
  /** Greyed out and not pickable; a function is asked each time the menu opens. */
  disabled?: boolean | ((detail: ContextMenuDetail) => boolean);
  run(detail: ContextMenuDetail): void;
}

export interface ContextMenuDetail extends GridSelection {
  /** Where the menu opens, in viewport coordinates. */
  x: number;
  y: number;
  /** The cell under the pointer, or at the active cell when the keyboard opened the menu; the column alone over a header, the row alone over a row number. */
  row: number | undefined;
  column: number | undefined;
  /** The entries to show: change this list to add, remove or reorder them for this opening. */
  items: ContextMenuItem[];
}

export interface SelectionCopyDetail {
  /** What goes to the clipboard: the cells of the newest range as tab-separated values. Change it to copy something else. */
  text: string;
  /** The range that was copied. */
  range: CellRange;
  /** Rows were left off, because the range holds more cells than one copy takes. */
  truncated: boolean;
}

export interface CellFocusDetail {
  rowId: RowId;
  rowIndex: number;
  columnId: Key;
  columnIndex: number;
}

/** Props of a drawable element (see utils/jsx); positions are relative to the draw origin. */
export interface RenderProps {
  value?: string;
  /** CSS font of the text; defaults to the renderer's own. */
  font?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** Free-form storage a renderer can keep per cell; it survives between frames. */
export type CellState = Record<string, unknown>;

export interface CellRow {
  id: RowId;
  index: number;
}

export interface CellColumn {
  id: Key;
  index: number;
  displayName?: string;
  /** Font of this column's cells, when it has its own. */
  font?: string;
  /** Font of this column's header, when it has its own. */
  headerFont?: string;
}

/**
 * Everything a renderer needs to draw one cell, header or row number.
 *
 * One object is reused for every cell, so read what you need while drawing and never keep a reference to it.
 */
export interface CellContext {
  /** Context of the layer the renderer is registered for. */
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Undefined for headers and placeholder cells. */
  row: CellRow | undefined;
  /** Undefined for row numbers. */
  column: CellColumn | undefined;
  /** Raw value as stored. */
  value: unknown;
  /** Value after the column's `valueFormatter`; this is what the built-in renderers draw. */
  formatted: string;
  /** When the value last changed, in ms since the epoch. */
  updatedAt: number | undefined;
  /** Milliseconds since `updatedAt`; Infinity when the value never changed. */
  age: number;
  /** Timestamp of the current frame. */
  now: number;
  /** Milliseconds since the previous frame. */
  dt: number;
  /** The formatted value differs from what was drawn last time. */
  valueChanged: boolean;
  /** Everything has to be redrawn: first draw, resize or scrolling. */
  forced: boolean;
  isScrolling: boolean;
  /**
   * For a column header: how much of its column is selected; for a row number: how much of its row. Always `'none'` for data cells,
   * whose selection is drawn on the `selection` layer.
   */
  selected: SelectionLevel;
  state: CellState;
}

/** Draws into one named layer. Register it with `grid.registerRenderer` and select it per column. */
export interface CellRenderer {
  /** Name of the layer `ctx` belongs to. */
  readonly layer: string;
  draw(cell: Readonly<CellContext>): void;
  /** Return true while the cell is animating; it is redrawn every frame, plus once more after it stops. */
  isAnimating?(cell: Readonly<CellContext>): boolean;
  clearCache?(): void;
}

/** A renderer, or the name it was registered under. */
export type RendererRef = string | CellRenderer;

/** A cell by the ids of its row and column, with the value stored in it. */
export interface CellEditContext {
  rowId: RowId;
  rowIndex: number;
  columnId: Key;
  columnIndex: number;
  /** The raw value stored in the cell. */
  value: unknown;
}

/** Whether a column's cells can be edited: for all of them, or decided per cell. */
export type CellEditable = boolean | ((cell: CellEditContext) => boolean);

export interface SelectOption {
  value: unknown;
  /** Text shown for the option; defaults to the value as text. */
  label?: string;
}

/** The built-in editors: `'text'`, `'number'`, a `'checkbox'` for booleans, or a `select` among `options`. */
export type BuiltInCellEditor = 'text' | 'number' | 'checkbox' | { type: 'select'; options: readonly (string | number | SelectOption)[] };

/** What a custom editor is built from. */
export interface CellEditorContext extends CellEditContext {
  /** The key that started editing by typing; the editor starts with this text instead of the value. Undefined otherwise. */
  initialText: string | undefined;
  /** Ends editing with the editor's current value, as Enter does. */
  commit(): void;
  /** Ends editing and keeps the old value, as Escape does. */
  cancel(): void;
}

/** A custom editor: the grid puts `element` over the cell, focuses it, and asks `getValue` when the user commits. */
export interface CellEditorInstance {
  element: HTMLElement;
  /** The edited value. Strings from the built-in text and number editors go through the column's `valueParser`; a custom editor's value is used as it is. */
  getValue(): unknown;
  /** Called instead of focusing `element`. */
  focus?(): void;
  /** Called each time the grid moved the editor (scrolling, resizing), and with `false` while it is clipped out of sight; for parts that sit outside `element`, such as a popup. */
  place?(visible: boolean): void;
  /** Called when editing ended, to clean up. */
  destroy?(): void;
}

export type CustomCellEditor = (context: CellEditorContext) => CellEditorInstance;

export type CellEditor = BuiltInCellEditor | CustomCellEditor;

/** A change about to be written: what `valueSetter` and `validator` get. */
export interface CellValueChange extends CellEditContext {
  /** The value the cell holds now (`value` is the same). */
  oldValue: unknown;
  newValue: unknown;
}

export interface CellEditStartDetail extends CellEditContext {}

export interface CellEditEndDetail extends CellEditContext {
  /** Editing was cancelled; the cell keeps its value. */
  cancelled: boolean;
  /** The committed value; undefined when cancelled. */
  newValue: unknown;
}

export interface CellValueChangedDetail extends CellEditContext {
  oldValue: unknown;
  newValue: unknown;
}

/** What an edit does when its cell scrolls out of view: write the value, drop it, or keep the editor (hidden) until the cell is back. */
export type EditOutOfView = 'commit' | 'cancel' | 'keep';
