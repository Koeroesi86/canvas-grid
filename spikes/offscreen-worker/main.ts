import { applyUpdates, createValues, drawGrid, summarise } from './draw';
import type { FrameStats } from './draw';

declare global {
  interface Window { spikeResult?: FrameStats }
}

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') ?? 'main';
const busy = params.get('busy') === '1';
const rows = Number(params.get('rows') ?? 100_000);
const durationMs = Number(params.get('duration') ?? 4000);
const updatesPerFrame = Number(params.get('updates') ?? 1000);
const step = 40;
const width = 1280;
const height = 800;

const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
document.body.appendChild(canvas);

// Stands in for the application: a main thread that is half-occupied by its own work (parsing a feed, React renders...).
if (busy) {
  setInterval(() => {
    const until = performance.now() + 25;
    while (performance.now() < until);
  }, 50);
}

if (mode === 'worker') {
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<FrameStats>) => { window.spikeResult = data; };
  worker.postMessage({ canvas: offscreen, rows, width, height, durationMs, updatesPerFrame, step }, [offscreen]);
} else {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D context not available');
  const values = createValues(rows, Math.ceil(width / 100));
  const deltas: number[] = [];
  const draws: number[] = [];
  const start = performance.now();
  let previous = start;
  let scrollY = 0;
  const tick = () => {
    const now = performance.now();
    deltas.push(now - previous);
    previous = now;
    scrollY = (scrollY + step) % (rows * 24 - height);
    const drawStart = performance.now();
    applyUpdates(values, updatesPerFrame);
    drawGrid(ctx, values, rows, width, height, scrollY);
    draws.push(performance.now() - drawStart);
    if (now - start < durationMs) {
      requestAnimationFrame(tick);
      return;
    }
    window.spikeResult = summarise(deltas, draws);
  };
  requestAnimationFrame(tick);
}
