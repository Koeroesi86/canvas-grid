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
