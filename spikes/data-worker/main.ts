import { applyChanges, createChanges, createRows, createStore, loadRows, readWindow, sortBy } from './ops';

interface Row {
  scenario: string;
  where: 'main' | 'worker';
  /** Time the main thread spent running code for the operation (compute on main, or send + receive for the worker). */
  mainBlockedMs: number;
  /** From request to result being available on the main thread. */
  totalMs: number;
  /** Longest gap between animation frames while it ran: what the user would see as a stall. */
  longestFrameMs: number;
}

declare global {
  interface Window { spikeResult?: Row[] }
}

const params = new URLSearchParams(window.location.search);
const rowCount = Number(params.get('rows') ?? 100_000);
const runs = Number(params.get('runs') ?? 5);
const changeCount = 1000;

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
let nextId = 0;
const pending = new Map<number, (message: { computeMs: number; payload: unknown; receivedMs: number }) => void>();
worker.onmessage = ({ data }) => {
  const received = performance.now();
  pending.get(data.id)?.({ ...data, receivedMs: received });
};
interface Sent { totalMs: number; mainBlockedMs: number }
/** Sends a request; resolves with the main thread's cost of sending and handling the reply. */
const ask = (request: Record<string, unknown>, transfer: Transferable[] = []) => new Promise<Sent & { payload: unknown }>(resolve => {
  const id = nextId++;
  const start = performance.now();
  pending.set(id, ({ payload, receivedMs }) => {
    const handled = performance.now();
    pending.delete(id);
    resolve({ payload, totalMs: handled - start, mainBlockedMs: sendMs + (handled - receivedMs) });
  });
  worker.postMessage({ id, ...request }, transfer);
  const sendMs = performance.now() - start;
});

// Frame monitor: the longest gap between frames while an operation runs.
let longestGap = 0;
let lastFrame = performance.now();
const watch = () => {
  const now = performance.now();
  longestGap = Math.max(longestGap, now - lastFrame);
  lastFrame = now;
  requestAnimationFrame(watch);
};
requestAnimationFrame(watch);
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const median = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];

const measure = async (scenario: string, where: Row['where'], prepare: () => Promise<void>, run: () => Promise<Sent | undefined>) => {
  const samples: Row[] = [];
  for (let i = 0; i < runs; i++) {
    await prepare();
    await nextFrame();
    longestGap = 0;
    lastFrame = performance.now();
    const start = performance.now();
    const sent = await run();
    const totalMs = sent?.totalMs ?? performance.now() - start;
    const mainBlockedMs = sent?.mainBlockedMs ?? totalMs;
    await nextFrame();
    samples.push({ scenario, where, mainBlockedMs, totalMs, longestFrameMs: longestGap });
  }
  return {
    scenario,
    where,
    mainBlockedMs: median(samples.map(s => s.mainBlockedMs)),
    totalMs: median(samples.map(s => s.totalMs)),
    longestFrameMs: median(samples.map(s => s.longestFrameMs)),
  };
};

const results: Row[] = [];
const noop = async () => {};

const mainStore = createStore();
const rows = createRows(rowCount);

// load
results.push(await measure('load rows', 'main', noop, async () => { loadRows(createStore(), rows); return undefined; }));
results.push(await measure('load rows (rows cloned to worker)', 'worker', noop, () => ask({ type: 'load', data: rows })));
results.push(await measure('load rows (feed arrives in the worker)', 'worker', noop, () => ask({ type: 'generate', rows: rowCount })));

// the stores stay loaded for the rest
loadRows(mainStore, rows);
await ask({ type: 'generate', rows: rowCount });

results.push(await measure(`update ${changeCount} cells`, 'main', noop, async () => { applyChanges(mainStore, createChanges(rowCount, changeCount)); return undefined; }));
results.push(await measure(`update ${changeCount} cells`, 'worker', noop, () => ask({ type: 'update', changes: createChanges(rowCount, changeCount) })));

const sorts = [['sort number column', 'price'], ['sort text column', 'name']] as const;
for (const [label, columnId] of sorts) {
  results.push(await measure(label, 'main', async () => { sortBy(mainStore, undefined); }, async () => { sortBy(mainStore, columnId); return undefined; }));
  results.push(await measure(label, 'worker', async () => { await ask({ type: 'sort' }); }, () => ask({ type: 'sort', columnId })));
}

results.push(await measure('read 50-row window', 'main', noop, async () => { readWindow(mainStore, 1000, 1050); return undefined; }));
results.push(await measure('read 50-row window', 'worker', noop, () => ask({ type: 'window', from: 1000, to: 1050 })));

window.spikeResult = results;
