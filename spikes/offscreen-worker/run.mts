import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '../..');
const server = await createServer({ configFile: false, root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const { port } = server.httpServer?.address() as { port: number };

const scenarios = [
  { mode: 'main', busy: 0 },
  { mode: 'worker', busy: 0 },
  { mode: 'main', busy: 1 },
  { mode: 'worker', busy: 1 },
];

const browser = await chromium.launch();
const lines = [
  '### OffscreenCanvas spike (#36)',
  '',
  '| mode | busy main thread | fps | frame median (ms) | frame p95 (ms) | draw mean (ms) |',
  '| --- | --- | ---: | ---: | ---: | ---: |',
];
try {
  for (const { mode, busy } of scenarios) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => { throw error; });
    await page.goto(`http://127.0.0.1:${port}/spikes/offscreen-worker/index.html?mode=${mode}&busy=${busy}`);
    await page.waitForFunction(() => 'spikeResult' in window && window.spikeResult !== undefined, undefined, { timeout: 60_000 });
    const r = await page.evaluate(() => window.spikeResult);
    await page.close();
    if (!r) throw new Error('no result');
    lines.push(`| ${mode} | ${busy ? 'yes' : 'no'} | ${r.fps.toFixed(1)} | ${r.frameMedianMs.toFixed(1)} | ${r.frameP95Ms.toFixed(1)} | ${r.drawMeanMs.toFixed(2)} |`);
  }
} finally {
  await browser.close();
  await server.close();
}
const markdown = lines.join('\n');
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
