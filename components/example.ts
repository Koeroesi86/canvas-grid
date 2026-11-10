import './web-component';
import { bindFontPicker, configureGrid, formatNumber, parseSort, withColumnOptions } from '../site/grid-setup.js';
import type { RowInput } from './types';

/** What `site/data-worker.js` posts: the columns and rows once, then batches of ticks. */
interface FeedColumn {
  id: string;
  displayName?: string;
  width?: number;
}

type FeedMessage =
  | { type: 'init'; columns: FeedColumn[]; rows: RowInput[] }
  | { type: 'ticks'; rows: RowInput[] };

const DEFAULT_COLUMN_WIDTH = 100;

const byId = <Element extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`#${id} not found`);
  return element as Element;
};

const init = () => {
  const grid = document.querySelector('canvas-grid');
  if (!grid) throw new Error('canvas-grid element not found');

  // the same feed and options as the demo site (site/demo.js), but running on the sources in this checkout
  const worker = new Worker(new URL('../site/data-worker.js', import.meta.url));
  const rows = byId<HTMLSelectElement>('rows');
  const rate = byId<HTMLSelectElement>('rate');
  const sort = byId<HTMLSelectElement>('sort');
  const pause = byId<HTMLButtonElement>('pause');
  const status = byId('status');
  let updates = 0;
  let feedColumns: FeedColumn[] = [];
  let fittedWidth = 0;

  const showStatus = (message: string) => {
    status.textContent = message;
    status.hidden = !message;
  };
  const applySort = () => grid.setSortModel(parseSort(sort.value));
  const requestRows = () => {
    showStatus('Generating rows in the worker…');
    worker.postMessage({ type: 'start', rows: Number(rows.value) });
  };

  /** Stretches the columns to the grid's width, so there is no empty canvas right of the last one. */
  const fitColumns = () => {
    const available = Math.floor(grid.canvas.clientWidth - grid.rowNumbersWidth) - 1;
    const natural = feedColumns.reduce((sum, column) => sum + (column.width ?? DEFAULT_COLUMN_WIDTH), 0);
    if (feedColumns.length === 0 || available === fittedWidth) return;

    fittedWidth = available;
    const scale = Math.max(1, available / natural);
    const widths = feedColumns.map(column => Math.floor((column.width ?? DEFAULT_COLUMN_WIDTH) * scale));
    // rounding down leaves a few pixels, which the last column takes
    widths[widths.length - 1] += Math.max(0, available - widths.reduce((sum, width) => sum + width, 0));
    grid.setColumns(withColumnOptions(feedColumns.map((column, index) => ({ ...column, width: widths[index] }))));
  };

  configureGrid(grid);
  bindFontPicker(byId<HTMLSelectElement>('font'), grid);
  new ResizeObserver(fitColumns).observe(grid);

  worker.addEventListener('message', ({ data }: MessageEvent<FeedMessage>) => {
    if (data.type === 'init') {
      feedColumns = data.columns;
      fittedWidth = 0;
      fitColumns();
      grid.setValues(data.rows);
      applySort();
      byId('stat-rows').textContent = formatNumber(data.rows.length);
      showStatus('');
    }
    if (data.type === 'ticks') {
      updates += data.rows.length;
      grid.transaction({ update: data.rows });
    }
  });
  worker.addEventListener('error', () => showStatus('The data worker failed to start.'));

  rows.addEventListener('change', requestRows);
  sort.addEventListener('change', applySort);
  rate.addEventListener('change', () => worker.postMessage({ type: 'rate', updatesPerSecond: Number(rate.value) }));
  pause.addEventListener('click', () => {
    const paused = pause.textContent === 'Pause feed';
    pause.textContent = paused ? 'Resume feed' : 'Pause feed';
    worker.postMessage({ type: 'pause', paused });
  });

  setInterval(() => {
    byId('stat-rate').textContent = `${formatNumber(updates)} / s`;
    updates = 0;
  }, 1000);

  worker.postMessage({ type: 'rate', updatesPerSecond: Number(rate.value) });
  requestRows();
};

window.addEventListener('load', init);
