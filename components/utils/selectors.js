export const getColumn = (row, key) => row.columns.get(key);

export const getNow = () => new Date().valueOf();


export const generateColumn = (value, key, updatedAt) => ({
  column: key,
  value: value,
  updatedAt: updatedAt ? updatedAt : null,
});

export const getRowId = (row, index) => row.id;
