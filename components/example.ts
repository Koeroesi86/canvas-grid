import './web-component';
import { configureGrid, formatNumber, parseSort, withColumnOptions } from '../site/grid-setup.js';
import type { RowInput } from './types';

/** What `site/data-worker.js` posts: the columns and rows once, then batches of ticks. */
type FeedMessage =
  | { type: 'init'; columns: Array<{ id: string; displayName?: string; width?: number }>; rows: RowInput[] }
  | { type: 'ticks'; rows: RowInput[] };

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

  const showStatus = (message: string) => {
    status.textContent = message;
    status.hidden = !message;
  };
  const applySort = () => grid.setSortModel(parseSort(sort.value));
  const requestRows = () => {
    showStatus('Generating rows in the worker…');
    worker.postMessage({ type: 'start', rows: Number(rows.value) });
  };

  configureGrid(grid);

  worker.addEventListener('message', ({ data }: MessageEvent<FeedMessage>) => {
    if (data.type === 'init') {
      grid.setColumns(withColumnOptions(data.columns));
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
