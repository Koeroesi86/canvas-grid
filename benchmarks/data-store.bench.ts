import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import DataStore from '../components/utils/data-store';
import { measure, type Measurement } from './measure';
import type { RowInput } from '../components/types';

/** Row counts to measure; override with e.g. BENCH_ROWS=1000,1000000 */
const rowCounts = (process.env.BENCH_ROWS ?? '1000,5000,20000').split(',').map(Number);

/** When set, the measurements are also written there as JSON, for scripts/compare-data-store.mts. */
const outputPath = process.env.DATA_STORE_OUTPUT;

const BATCH = 1000;

const createStore = () => new DataStore({
  getRowId: row => row.id,
  getCellHeight: () => 20,
});

const createRows = (count: number): RowInput[] => Array.from(
  { length: count },
  (_, id) => ({ id, name: `row ${id}`, price: id * 1.5, quantity: id % 100 }),
);

interface DataStoreMeasurement extends Measurement {
  rows: number;
}

const measureStore = (count: number): DataStoreMeasurement[] => {
  const rows = createRows(count);
  const store = createStore();
  store.setRows(rows);
  let tick = 0;
  const heavy = count > 20_000 ? { runs: 3, warmup: 1 } : { runs: 10, warmup: 2 };

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
  ].map(measurement => ({ ...measurement, rows: count }));
};

it('data store benchmarks', () => {
  const results = rowCounts.flatMap(measureStore);
  console.table(results.map(({ rows, name, medianMs, p95Ms, opsPerSecond }) => ({ name: `${rows} rows: ${name}`, 'median ms': medianMs, 'p95 ms': p95Ms, 'ops/s': opsPerSecond })));
  if (outputPath) writeFileSync(outputPath, JSON.stringify(results));
}, Infinity);
