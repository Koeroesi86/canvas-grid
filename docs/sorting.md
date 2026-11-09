# Sorting

```js
grid.setSortModel([
  { columnId: 'price', direction: 'desc' },
  { columnId: 'name' },
]);
```

Keys apply in priority order; rows equal on every key keep their original order. By default numbers compare numerically, text with `Intl.Collator`, and empty values come last; a key can bring its own `compare(a, b)`. Row numbers follow the displayed order. The order is kept as rows are added or updated: new rows are placed by the model, and an update to a sorted column moves the row (re-sorting runs with the throttled updates; when few rows changed only those are moved, otherwise all rows are sorted again, O(n log n)). `setSortModel` works on raw values, so it does not depend on `valueFormatter`.
