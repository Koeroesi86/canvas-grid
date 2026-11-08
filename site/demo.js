// `?local` loads the grid from ./build (see `npm run site`) instead of unpkg, to try unreleased changes.
const local = new URLSearchParams(location.search).has('local');
const gridUrl = local ? '/build/web-component.mjs' : 'https://unpkg.com/@koeroesi86/canvas-grid/build/web-component.mjs';
const versionUrl = 'https://unpkg.com/@koeroesi86/canvas-grid/package.json';

const byId = id => document.getElementById(id);
const format = new Intl.NumberFormat('en-US');

const formatters = {
  price: value => Number(value).toFixed(2),
  bid: value => Number(value).toFixed(2),
  ask: value => Number(value).toFixed(2),
  high: value => Number(value).toFixed(2),
  low: value => Number(value).toFixed(2),
  change: value => `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(2)}%`,
  volume: value => format.format(Number(value)),
};

// A small bar under the change value: green for a gain, red for a loss, longer for bigger moves.
const trendRenderer = {
  layer: 'trend',
  draw({ ctx, x, y, width, height, value, valueChanged, forced }) {
    if (!valueChanged && !forced) return;

    ctx.clearRect(x, y, width, height);
    const change = Number(value);
    if (!change) return;

    ctx.fillStyle = change > 0 ? '#3fb950' : '#f85149';
    ctx.fillRect(x, y + height - 3, Math.min(width, (Math.abs(change) / 5) * width), 2);
  },
};

const parseSort = value => value
  ? value.split(',').map(key => {
    const [columnId, direction] = key.split(':');
    return { columnId, direction };
  })
  : [];

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

  grid.font = '12px ui-monospace, Menlo, Consolas, monospace';
  grid.headerFont = '600 13px system-ui, sans-serif';
  grid.addLayer('trend', { before: 'header' });
  grid.registerRenderer('trend', trendRenderer);

  const applySort = () => grid.setSortModel(parseSort(byId('sort').value));
  const requestRows = () => {
    showStatus('Generating rows in the worker…');
    worker.postMessage({ type: 'start', rows: Number(byId('rows').value) });
  };

  worker.addEventListener('message', ({ data }) => {
    if (data.type === 'init') {
      grid.setColumns(data.columns.map(column => ({
        ...column,
        ...(formatters[column.id] && { valueFormatter: formatters[column.id] }),
        ...(column.id === 'change' && { renderers: ['background', 'value', 'trend'] }),
      })));
      grid.setValues(data.rows);
      applySort();
      byId('stat-rows').textContent = format.format(data.rows.length);
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
    byId('stat-rate').textContent = `${format.format(updates)} / s`;
    updates = 0;
  }, 1000);

  worker.postMessage({ type: 'rate', updatesPerSecond: Number(byId('rate').value) });
  requestRows();
  loadVersion()
    .then(version => { byId('stat-version').textContent = version; })
    .catch(() => { byId('stat-version').textContent = 'latest'; });
};

window.addEventListener('DOMContentLoaded', start);
