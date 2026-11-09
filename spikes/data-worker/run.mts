import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '../..');
const rows = Number(process.env.SPIKE_ROWS ?? 100_000);
const server = await createServer({ configFile: false, root, logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const { port } = server.httpServer?.address() as { port: number };

const browser = await chromium.launch();
let results: { scenario: string; where: string; mainBlockedMs: number; totalMs: number; longestFrameMs: number }[] | undefined;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => { throw error; });
  await page.goto(`http://127.0.0.1:${port}/spikes/data-worker/index.html?rows=${rows}`);
  await page.waitForFunction(() => window.spikeResult !== undefined, undefined, { timeout: 240_000 });
  results = await page.evaluate(() => window.spikeResult);
} finally {
  await browser.close();
  await server.close();
}
if (!results) throw new Error('no result');

const lines = [
  `### Data store in a worker spike (#36), ${rows.toLocaleString('en')} rows x 5 columns`,
  '',
  '| operation | where | main thread blocked (ms) | request to result (ms) | longest frame (ms) |',
  '| --- | --- | ---: | ---: | ---: |',
  ...results.map(r => `| ${r.scenario} | ${r.where} | ${r.mainBlockedMs.toFixed(1)} | ${r.totalMs.toFixed(1)} | ${r.longestFrameMs.toFixed(1)} |`),
];
const markdown = lines.join('\n');
console.log(markdown);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
