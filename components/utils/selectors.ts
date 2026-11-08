import type { RowId, RowInput } from '../types';

export const getNow = () => new Date().valueOf();

export const getRowId = (row: RowInput, _index?: number): RowId => row.id;
