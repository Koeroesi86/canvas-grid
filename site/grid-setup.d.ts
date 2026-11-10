import type { ColumnDefinition } from '../components/web-component';
import type CanvasGrid from '../components/web-component';
import type { SortKey } from '../components/types';

export const formatNumber: (value: number) => string;
export const parseSort: (value: string) => SortKey[];
export const configureGrid: (grid: CanvasGrid) => void;
export const withColumnOptions: (columns: Array<{ id: string; displayName?: string; width?: number }>) => ColumnDefinition[];
export const fontFamilies: Record<string, string>;
export const applyFontFamily: (grid: CanvasGrid, family: string) => void;
export const bindFontPicker: (select: HTMLSelectElement, grid: CanvasGrid) => void;
