import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { STALL_FRAME_MS } from '../scripts/benchmark-comparison.mts';

/** Directory serving components/ and benchmarks/scroll/; defaults to this repository, set it to measure another checkout. */
const root = resolve(process.env.SCROLL_ROOT ?? resolve(import.meta.dirname, '..'));
/** Optional path to also write the result to as JSON. */
const outputPath = process.env.SCROLL_OUTPUT;
const rows = Number(process.env.SCROLL_ROWS ?? 100_000);
const columns = Number(process.env.SCROLL_COLUMNS ?? 20);
const durationMs = Number(process.env.SCROLL_DURATION_MS ?? 5000);
/** Pixels scrolled per animation frame. */
const step = Number(process.env.SCROLL_STEP ?? 40);

/** Launch flags that make headless Chromium rasterise on the GPU (the default is software, SwiftShader). */
const GPU_ARGS = ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
/** Set SCROLL_GPU=1 to measure with the GPU, for local comparisons; CI uses the default. */
const useGpu = process.env.SCROLL_GPU === '1';

interface ScrollResult {
  /** What drew the canvas, e.g. SwiftShader (software) or the GPU name; results from different renderers are not comparable. */
  renderer: string;
  frames: number;
  seconds: number;
  fps: number;
  frameMedianMs: number;
  frameP95Ms: number;
  frameMaxMs: number;
  /** Time spent in the grid's draw per frame; unlike the frame rate it is not capped by the display. */
  drawMeanMs: number;
  drawP95Ms: number;
  /** Frames slower than `STALL_FRAME_MS`; catches isolated stalls that percentiles hide. */
  stalledFrames: number;
  scrolledPx: number;
}

const server = await createServer({
  configFile: false,
  root,
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const { port } = server.httpServer?.address() as { port: number };

const browser = await chromium.launch(useGpu ? { channel: 'chromium', args: GPU_ARGS } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => { throw error; });
  await page.goto(`http://127.0.0.1:${port}/benchmarks/scroll/index.html?rows=${rows}&columns=${columns}`);
  await page.waitForFunction(() => window.benchmarkReady === true, undefined, { timeout: 120_000 });
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl ? String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : 'unknown (no WebGL)';
  });
  await page.waitForTimeout(1000);
  // Scroll for a moment first so the measurement sees steady state, not the cold first frames after idle.
  await page.evaluate(({ step }) => new Promise<void>(resolveWarmUp => {
    const scrollArea = document.querySelector('canvas-grid .scrollArea');
    if (!scrollArea) throw new Error('scroll area not found');
    let frames = 0;
    const tick = () => {
      scrollArea.scrollTop += step;
      if (++frames < 60) {
        requestAnimationFrame(tick);
        return;
      }
      scrollArea.scrollTop = 0;
      requestAnimationFrame(() => requestAnimationFrame(() => resolveWarmUp()));
    };
    requestAnimationFrame(tick);
  }), { step });
  await page.evaluate(() => { window.drawTimes = []; });

  const result: Omit<ScrollResult, 'renderer'> = await page.evaluate(({ durationMs, step, stallFrameMs }) => new Promise<Omit<ScrollResult, 'renderer'>>(resolveResult => {
    const scrollArea = document.querySelector('canvas-grid .scrollArea');
    if (!scrollArea) throw new Error('scroll area not found');
    const deltas: number[] = [];
    const start = performance.now();
    let previous = start;
    const tick = (now: number) => {
      deltas.push(now - previous);
      previous = now;
      scrollArea.scrollTop += step;
      if (now - start < durationMs) {
        requestAnimationFrame(tick);
        return;
      }
      const sorted = deltas.slice(1).sort((a, b) => a - b);
      const at = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
      const seconds = (now - start) / 1000;
      const draws = window.drawTimes.toSorted((a, b) => a - b);
      resolveResult({
        drawMeanMs: Number((draws.reduce((sum, time) => sum + time, 0) / Math.max(1, draws.length)).toFixed(3)),
        drawP95Ms: Number((draws[Math.min(draws.length - 1, Math.floor(draws.length * 0.95))] ?? 0).toFixed(3)),
        frames: sorted.length,
        seconds: Number(seconds.toFixed(2)),
        fps: Number((sorted.length / seconds).toFixed(1)),
        frameMedianMs: Number(at(0.5).toFixed(2)),
        frameP95Ms: Number(at(0.95).toFixed(2)),
        frameMaxMs: Number(sorted[sorted.length - 1].toFixed(2)),
        stalledFrames: sorted.filter(delta => delta > stallFrameMs).length,
        scrolledPx: scrollArea.scrollTop,
      });
    };
    requestAnimationFrame(tick);
  }), { durationMs, step, stallFrameMs: STALL_FRAME_MS });

  console.log(`Scroll benchmark: ${rows} rows x ${columns} columns, ${step}px per frame`);
  console.log(`Renderer: ${renderer}${/swiftshader|llvmpipe|software/i.test(renderer) ? ' (software, not a GPU)' : ''}`);
  console.table([result]);
  if (outputPath) await writeFile(outputPath, JSON.stringify({ renderer, ...result }, undefined, 2));
} finally {
  await browser.close();
  await server.close();
}
