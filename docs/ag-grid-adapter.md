# AG Grid-style adapter

`grid.agApi` mirrors a small part of AG Grid's API for easier migration:

```ts
grid.agApi.setColumnDefs(columns);
grid.agApi.setRowData(rows);
grid.agApi.updateRowData({ add: [], update: [], remove: [] });
grid.agApi.getRowNodeId = row => row.key;
```
