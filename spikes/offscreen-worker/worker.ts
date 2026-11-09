import { applyUpdates, createValues, drawGrid, summarise } from './draw';

interface StartMessage {
  canvas: OffscreenCanvas;
  rows: number;
  width: number;
  height: number;
  durationMs: number;
  updatesPerFrame: number;
  step: number;
}

// eslint-disable-next-line no-restricted-globals
self.onmessage = ({ data }: MessageEvent<StartMessage>) => {
  const { canvas, rows, width, height, durationMs, updatesPerFrame, step } = data;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D context not available in worker');
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
    postMessage(summarise(deltas, draws));
  };
  requestAnimationFrame(tick);
};
