import { bindFontPicker, configureGrid, formatNumber, parseSort, withColumnOptions } from './grid-setup.js';

// `?local` loads the grid from ./build (see `npm run site`) instead of unpkg, to try unreleased changes.
const local = new URLSearchParams(location.search).has('local');
const gridUrl = local ? '/build/web-component.mjs' : 'https://unpkg.com/@koeroesi86/canvas-grid/build/web-component.mjs';
const versionUrl = 'https://unpkg.com/@koeroesi86/canvas-grid/package.json';

const byId = id => document.getElementById(id);

const showStatus = message => {
  const status = byId('status');
  status.textContent = message;
  status.hidden = !message;
};

const loadVersion = async () => {
  if (local) return 'local build';

  const response = await fetch(versionUrl);
  if (!response.ok) throw new Error(`Version lookup failed: ${response.status}`);
  return (await response.json()).version;
};

const start = async () => {
  try {
    await import(gridUrl);
  } catch (error) {
    console.error(error);
    showStatus(local ? 'Could not load ./build, run "npm run build" first.' : 'Could not load the grid from unpkg.');
    return;
  }

  const grid = document.querySelector('canvas-grid');
  const worker = new Worker('data-worker.js');
  let updates = 0;

  configureGrid(grid);
  bindFontPicker(byId('font'), grid);

  const applySort = () => grid.setSortModel(parseSort(byId('sort').value));
  const requestRows = () => {
    showStatus('Generating rows in the worker…');
    worker.postMessage({ type: 'start', rows: Number(byId('rows').value) });
  };

  worker.addEventListener('message', ({ data }) => {
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

  byId('rows').addEventListener('change', requestRows);
  byId('sort').addEventListener('change', applySort);
  byId('rate').addEventListener('change', () => worker.postMessage({ type: 'rate', updatesPerSecond: Number(byId('rate').value) }));
  byId('pause').addEventListener('click', ({ currentTarget }) => {
    const paused = currentTarget.textContent === 'Pause feed';
    currentTarget.textContent = paused ? 'Resume feed' : 'Pause feed';
    worker.postMessage({ type: 'pause', paused });
  });

  setInterval(() => {
    byId('stat-rate').textContent = `${formatNumber(updates)} / s`;
    updates = 0;
  }, 1000);

  worker.postMessage({ type: 'rate', updatesPerSecond: Number(byId('rate').value) });
  requestRows();
  loadVersion()
    .then(version => { byId('stat-version').textContent = version; })
    .catch(() => { byId('stat-version').textContent = 'latest'; });
};

window.addEventListener('DOMContentLoaded', start);
