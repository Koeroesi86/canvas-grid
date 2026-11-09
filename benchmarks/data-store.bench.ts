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
/** Flushes per sample for the sub-millisecond cases, so a sample is a few ms and runner noise matters less. */
const FLUSHES = 20;
/** Empty flushes are so cheap that a sample needs thousands of them to reach a measurable time. */
const EMPTY_FLUSHES = 2000;
const WINDOW_ROWS = 50;
const WIDE_COLUMNS = 50;

interface DataStoreMeasurement extends Measurement {
  rows: number;
  /** What `medianMs` holds when it is not a time; memory entries report bytes per row. */
  unit?: 'bytes/row';
  /** Whether CI fails on a regression; the rest are reported for information only (noisier or less central). */
  gating: boolean;
}

const repeat = (times: number, run: () => void) => Array.from({ length: times }).forEach(() => run());

/** Only the core paths gate CI: every extra gated metric adds a chance of a false failure. */
const isGating = (name: string) => !/^(wide|hot cells|mixed flush|heap)|text column|sort active/.test(name);

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
const createWideRow = (id: number, count: number): RowInput => Object.fromEntries([
  ['id', id],
  ...Array.from({ length: WIDE_COLUMNS }, (_, column) => [`c${column}`, (id * 7919 + column) % count]),
]);

const createStoreWith = (rows: RowInput[]) => {
  const store = createStore();
  store.setRows(rows);
  return store;
};

/** Heap kept alive by a loaded store, per row. Needs `--expose-gc` (set in vitest.bench.config.mts); skipped otherwise. */
const retainedBytesPerRow = (rows: RowInput[]) => {
  const collect = globalThis.gc;
  if (!collect) return undefined;

  const samples = Array.from({ length: 3 }, () => {
    collect();
    const before = process.memoryUsage().heapUsed;
    const store = createStoreWith(rows);
    collect();
    const after = process.memoryUsage().heapUsed;
    // keeps the store alive until the second reading
    return store.rows.length > 0 ? (after - before) / rows.length : 0;
  }).sort((a, b) => a - b);
  return Math.round(samples[1]);
};

const measureMemory = (count: number, rows: RowInput[], wideRows: RowInput[]): DataStoreMeasurement[] => [
  ['heap after setRows', rows],
  [`heap after setRows (wide, ${WIDE_COLUMNS} columns)`, wideRows],
].flatMap(([name, data]) => {
  const bytes = retainedBytesPerRow(data as RowInput[]);
  return bytes === undefined ? [] : [{ name: name as string, runs: 3, medianMs: bytes, p95Ms: bytes, opsPerSecond: 0, unit: 'bytes/row' as const, rows: count, gating: false }];
});

const measureStore = (count: number): DataStoreMeasurement[] => {
  const rows = createRows(count);
  const store = createStoreWith(rows);
  const heavy = count > 20_000 ? { runs: 3, warmup: 1 } : { runs: 10, warmup: 2 };
  let tick = 0;

  const scrambledRows = Array.from({ length: count }, (_, id) => createScrambledRow(id, count));
  const sortStore = createStoreWith(scrambledRows);
  const sortedStore = createStoreWith(scrambledRows);
  sortedStore.setSortModel([{ columnId: 'price', direction: 'desc' }]);

  const wideRows = Array.from({ length: count }, (_, id) => createWideRow(id, count));
  const wideStore = createStoreWith(wideRows);

  const streamStore = createStoreWith(rows);
  let nextId = count;
  let oldestId = 0;

  const middle = Math.floor(count / 2);
  const windowIds = Array.from({ length: WINDOW_ROWS }, (_, index) => middle + index);
  const windowColumns = ['name', 'price', 'quantity'];

  const wideSortStore = createStoreWith(wideRows);

  const toggledDirection = (): SortDirection => (tick % 2 === 0 ? 'asc' : 'desc');
  const sortWideFromScratch = () => {
    tick += 1;
    wideSortStore.setSortModel([]);
    wideSortStore.setSortModel([{ columnId: 'c0', direction: toggledDirection() }]);
  };
  /** Back to insertion order first, so every run sorts scrambled data rather than reversing a sorted list. */
  const sortFromScratch = (columnId: string) => {
    tick += 1;
    sortStore.setSortModel([]);
    sortStore.setSortModel([{ columnId, direction: toggledDirection() }]);
  };

  return [
    measure('setRows', () => createStore().setRows(rows), { ...heavy, operations: count }),
    measure(`update ${BATCH} cells x${FLUSHES}`, () => repeat(FLUSHES, () => {
      tick += 1;
      Array.from({ length: BATCH }, (_, index) => ({ id: (index * 7) % count, price: tick + index }))
        .forEach(row => store.queueUpdate(row));
      store.flush();
    }), { ...heavy, operations: BATCH * FLUSHES }),
    measure(`remove + re-add ${BATCH}`, () => {
      const batch = Array.from({ length: BATCH }, (_, index) => rows[(index * 11) % count]);
      batch.forEach(row => store.queueRemove(row));
      store.flush();
      batch.forEach(row => store.queueUpdate(row));
      store.flush();
    }, { ...heavy, operations: BATCH * 2 }),

    // Nothing queued: this must stay near zero (it once scanned every row, see #32).
    measure(`${EMPTY_FLUSHES} empty flushes`, () => repeat(EMPTY_FLUSHES, () => store.flush()), { ...heavy, operations: EMPTY_FLUSHES }),

    measure('sort scrambled number column (incl. reset)', () => sortFromScratch('price'), { ...heavy, operations: count }),
    measure(`wide (${WIDE_COLUMNS} columns): sort number column (incl. reset)`, sortWideFromScratch, { ...heavy, operations: count }),
    measure('sort scrambled text column (incl. reset)', () => sortFromScratch('name'), { ...heavy, operations: count }),
    measure(`update ${BATCH} cells of the sort column`, () => {
      tick += 1;
      Array.from({ length: BATCH }, (_, index) => ({ id: (index * 7) % count, price: (tick * 31 + index * 7919) % count }))
        .forEach(row => sortedStore.queueUpdate(row));
      sortedStore.flush();
    }, { ...heavy, operations: BATCH }),

    // Removal on a sorted store: the removal and sort costs together.
    measure(`remove + re-add ${BATCH} (sort active)`, () => {
      const batch = Array.from({ length: BATCH }, (_, index) => scrambledRows[(index * 11) % count]);
      batch.forEach(row => sortedStore.queueRemove(row));
      sortedStore.flush();
      batch.forEach(row => sortedStore.queueUpdate(row));
      sortedStore.flush();
    }, { ...heavy, operations: BATCH * 2 }),

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
    measure(`wide (${WIDE_COLUMNS} columns): update ${BATCH} cells x${FLUSHES}`, () => repeat(FLUSHES, () => {
      tick += 1;
      Array.from({ length: BATCH }, (_, index) => ({ id: (index * 7) % count, [`c${index % WIDE_COLUMNS}`]: tick + index }))
        .forEach(row => wideStore.queueUpdate(row));
      wideStore.flush();
    }), { ...heavy, operations: BATCH * FLUSHES }),
    // Every removal renumbers the rows and compacts every column, so the column count multiplies its cost.
    measure(`wide (${WIDE_COLUMNS} columns): remove + re-add ${BATCH}`, () => {
      const batch = Array.from({ length: BATCH }, (_, index) => wideRows[(index * 11) % count]);
      batch.forEach(row => wideStore.queueRemove(row));
      wideStore.flush();
      batch.forEach(row => wideStore.queueUpdate(row));
      wideStore.flush();
    }, { ...heavy, operations: BATCH * 2 }),

    // A ticker: the same few rows are rewritten over and over within one flush.
    measure(`hot cells: ${BATCH} updates on 10 rows x${FLUSHES}`, () => repeat(FLUSHES, () => {
      tick += 1;
      Array.from({ length: BATCH }, (_, index) => ({ id: index % 10, price: tick + index }))
        .forEach(row => store.queueUpdate(row));
      store.flush();
    }), { ...heavy, operations: BATCH * FLUSHES }),

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
    ...measureMemory(count, rows, wideRows),
  ].map(measurement => ({ ...measurement, rows: count, gating: isGating(measurement.name) }));
};

it('data store benchmarks', () => {
  const results = rowCounts.flatMap(measureStore);
  console.table(results.map(({ rows, name, medianMs, p95Ms, opsPerSecond }) => ({ name: `${rows} rows: ${name}`, 'median ms': medianMs, 'p95 ms': p95Ms, 'ops/s': opsPerSecond })));
  if (outputPath) writeFileSync(outputPath, JSON.stringify(results));
}, Infinity);
