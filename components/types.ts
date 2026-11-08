export type Key = string | number;

export type RowId = Key;

export interface RowInput {
  id: RowId;
  [column: string]: unknown;
}

export interface ColumnData {
  column: string;
  value: unknown;
  displayedValue: string;
  updatedAt: number | undefined;
}

export interface RowData<Columns> {
  index: number;
  height: number;
  columns: Columns;
}

export interface RenderProps {
  value?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isUpdated?: boolean;
  isValueUpdated?: boolean;
  forcedDraw?: boolean;
  diff?: number;
}

/** Renderer drawing straight onto a layer. */
export interface PositionalRenderer {
  isScrolling: boolean;
  clearCache(): void;
  preWarmCache(): void;
  render(props: RenderProps): void;
}
