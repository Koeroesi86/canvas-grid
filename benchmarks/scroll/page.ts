import '../../components/web-component';
import type { RowInput } from '../../components/types';

declare global {
  interface Window {
    benchmarkReady?: boolean;
    /** Duration in milliseconds of every grid draw, in order. */
    drawTimes: number[];
  }
}

const params = new URLSearchParams(window.location.search);
const rowCount = Number(params.get('rows') ?? 100_000);
const columnCount = Number(params.get('columns') ?? 20);

const columns = Array.from({ length: columnCount }, (_, index) => `column${index}`);
const rows = Array.from({ length: rowCount }, (_, id): RowInput => ({
  id,
  ...Object.fromEntries(columns.map((column, index) => [column, `${column} r${id} ${(id * (index + 3)) % 997}`])),
}));

const grid = document.querySelector('canvas-grid');
if (!grid) throw new Error('canvas-grid element not found');

// Frame rate saturates at the display refresh rate; the time spent drawing does not.
window.drawTimes = [];
const draw = grid.draw.bind(grid);
grid.draw = (...args) => {
  const start = performance.now();
  draw(...args);
  window.drawTimes.push(performance.now() - start);
};

// the default clips text without measuring it; the benchmark keeps the measured path, which is the costly one
grid.textOverflow = params.get('overflow') === 'clip' ? 'clip' : 'ellipsis';
grid.setColumns(columns);
grid.setValues(rows);
window.benchmarkReady = true;
