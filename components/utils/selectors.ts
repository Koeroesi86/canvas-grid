import type Collection from './collection';
import type { ColumnData, Key, RowId, RowInput } from '../types';

export const getColumn = (row: { columns: Collection<ColumnData> }, key: Key) => row.columns.get(key);

export const getNow = () => new Date().valueOf();

export const generateColumn = (
  value: unknown,
  key: string,
  updatedAt: number | undefined,
  displayedValue: string,
): ColumnData => ({
  column: key,
  value,
  displayedValue,
  updatedAt: updatedAt || undefined,
});

export const getRowId = (row: RowInput, _index?: number): RowId => row.id;
