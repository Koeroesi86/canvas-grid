import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import DataStore from '../components/utils/data-store';
import { measure, type Measurement } from './measure';
import type { RowInput, SortDirection } from '../components/types';

/** Row counts to measure; override with e.g. BENCH_ROWS=1000,1000000 */
const rowCounts = (process.env.BENCH_ROWS ?? '1000,5000,20000').split(',').map(Number);

/** When set, the measurements are also written there as JSON, for scripts/compare-data-store.mts. */
const outputPath = process.env.DATA_STORE_OUTPUT;

const BATCH = 1000;
/** Cheap operations are repeated within one sample so it is well above timer resolution. */
const REPEATS = 100;
const WINDOW_ROWS = 50;
const WIDE_COLUMNS = 50;

interface DataStoreMeasurement extends Measurement {
  rows: number;
}

const createStore = () => new DataStore({
  getRowId: row => row.id,
  getCellHeight: () => 20,
});

const createRow = (id: number): RowInput => ({ id, name: `row ${id}`, price: id * 1.5, quantity: id % 100 });

/** Values in an order unrelated to the insertion order, so sorting does real work (sorted input is a best case). */
const createScrambledRow = (id: number, count: number): RowInput => {
  const scrambled = (id * 7919) % count;
  return { id, name: `item ${scrambled}`, price: scrambled * 1.5, quantity: scrambled % 100 };
};

const createRows = (count: number): RowInput[] => Array.from({ length: count }, (_, id) => createRow(id));

/** Rows with many numeric columns, `c0`..`c49`. */
const createWideRow = (id: number): RowInput => Object.fromEntries([
  ['id', id],
  ...Array.from({ length: WIDE_COLUMNS }, (_, column) => [`c${column}`, id + column]),
]);

const createStoreWith = (rows: RowInput[]) => {
  const store = createStore();
  store.setRows(rows);
  return store;
};

const measureStore = (count: number): DataStoreMeasurement[] => {
  const rows = createRows(count);
  const store = createStoreWith(rows);
  const heavy = count > 20_000 ? { runs: 3, warmup: 1 } : { runs: 10, warmup: 2 };
  let tick = 0;

  const scrambledRows = Array.from({ length: count }, (_, id) => createScrambledRow(id, count));
  const sortStore = createStoreWith(scrambledRows);
  const sortedStore = createStoreWith(scrambledRows);
  sortedStore.setSortModel([{ columnId: 'price', direction: 'desc' }]);

  const wideRows = Array.from({ length: count }, (_, id) => createWideRow(id));
  const wideStore = createStoreWith(wideRows);

  const streamStore = createStoreWith(rows);
  let nextId = count;
  let oldestId = 0;

  const middle = Math.floor(count / 2);
  const windowIds = Array.from({ length: WINDOW_ROWS }, (_, index) => middle + index);
  const windowColumns = ['name', 'price', 'quantity'];

  const toggledDirection = (): SortDirection => (tick % 2 === 0 ? 'asc' : 'desc');
  /** Back to insertion order first, so every run sorts scrambled data rather than reversing a sorted list. */
  const sortFromScratch = (columnId: string) => {
    tick += 1;
    sortStore.setSortModel([]);
    sortStore.setSortModel([{ columnId, direction: toggledDirection() }]);
  };

  return [
    measure('setRows', () => createStore().setRows(rows), { ...heavy, operations: count }),
    measure(`update ${BATCH} cells`, () => {
      tick += 1;
      Array.from({ length: BATCH }, (_, index) => ({ id: (index * 7) % count, price: tick + index }))
        .forEach(row => store.queueUpdate(row));
      store.flush();
    }, { ...heavy, operations: BATCH }),
    measure(`remove + re-add ${BATCH}`, () => {
      const batch = Array.from({ length: BATCH }, (_, index) => rows[(index * 11) % count]);
      batch.forEach(row => store.queueRemove(row));
      store.flush();
      batch.forEach(row => store.queueUpdate(row));
      store.flush();
    }, { ...heavy, operations: BATCH * 2 }),

    // Nothing queued: this must stay near zero (it once scanned every row, see #32).
    measure(`${REPEATS} empty flushes`, () => {
      Array.from({ length: REPEATS }).forEach(() => store.flush());
    }, { ...heavy, operations: REPEATS }),

    measure('sort scrambled number column (incl. reset)', () => sortFromScratch('price'), { ...heavy, operations: count }),
    measure('sort scrambled text column (incl. reset)', () => sortFromScratch('name'), { ...heavy, operations: count }),
    measure(`update ${BATCH} cells of the sort column`, () => {
      tick += 1;
      Array.from({ length: BATCH }, (_, index) => ({ id: (index * 7) % count, price: (tick * 31 + index * 7919) % count }))
        .forEach(row => sortedStore.queueUpdate(row));
      sortedStore.flush();
    }, { ...heavy, operations: BATCH }),

    // What the draw path does every frame for the visible range.
    measure(`read ${WINDOW_ROWS} visible rows x ${windowColumns.length} columns x ${REPEATS}`, () => {
      Array.from({ length: REPEATS }).forEach(() => windowIds.forEach(id => windowColumns.forEach((column) => {
        store.getValue(id, column);
        store.getUpdatedAt(id, column);
      })));
    }, { ...heavy, operations: REPEATS * WINDOW_ROWS * windowColumns.length * 2 }),

    // Streaming: new rows arrive and the oldest leave, so the store stays the same size.
    measure(`append ${BATCH} new rows, drop ${BATCH} oldest`, () => {
      Array.from({ length: BATCH }, () => {
        nextId += 1;
        return createRow(nextId);
      }).forEach(row => streamStore.queueUpdate(row));
      Array.from({ length: BATCH }, () => {
        oldestId += 1;
        return { id: oldestId };
      }).forEach(row => streamStore.queueRemove(row));
      streamStore.flush();
    }, { ...heavy, operations: BATCH * 2 }),

    // Many columns and one cell per row, as opposed to the four columns above.
    measure(`wide (${WIDE_COLUMNS} columns): setRows`, () => createStore().setRows(wideRows), { ...heavy, operations: count }),
    measure(`wide (${WIDE_COLUMNS} columns): update ${BATCH} cells`, () => {
      tick += 1;
      Array.from({ length: BATCH }, (_, index) => ({ id: (index * 7) % count, [`c${index % WIDE_COLUMNS}`]: tick + index }))
        .forEach(row => wideStore.queueUpdate(row));
      wideStore.flush();
    }, { ...heavy, operations: BATCH }),

    // A ticker: the same few rows are rewritten over and over within one flush.
    measure(`hot cells: ${BATCH} updates on 10 rows`, () => {
      tick += 1;
      Array.from({ length: BATCH }, (_, index) => ({ id: index % 10, price: tick + index }))
        .forEach(row => store.queueUpdate(row));
      store.flush();
    }, { ...heavy, operations: BATCH }),

    // Updates, new rows and removals queued together, then one flush.
    measure('mixed flush: 700 updates, 200 appends, 100 removes', () => {
      tick += 1;
      Array.from({ length: 700 }, (_, index) => ({ id: (index * 7) % count, price: tick + index }))
        .forEach(row => streamStore.queueUpdate(row));
      Array.from({ length: 200 }, () => {
        nextId += 1;
        return createRow(nextId);
      }).forEach(row => streamStore.queueUpdate(row));
      Array.from({ length: 100 }, () => {
        oldestId += 1;
        return { id: oldestId };
      }).forEach(row => streamStore.queueRemove(row));
      streamStore.flush();
    }, { ...heavy, operations: 1000 }),
  ].map(measurement => ({ ...measurement, rows: count }));
};

it('data store benchmarks', () => {
  const results = rowCounts.flatMap(measureStore);
  console.table(results.map(({ rows, name, medianMs, p95Ms, opsPerSecond }) => ({ name: `${rows} rows: ${name}`, 'median ms': medianMs, 'p95 ms': p95Ms, 'ops/s': opsPerSecond })));
  if (outputPath) writeFileSync(outputPath, JSON.stringify(results));
}, Infinity);
