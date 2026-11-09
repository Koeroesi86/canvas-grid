// What the demo page and `npm run dev` share: formatting, the trend layer and the sort-option parser.
const format = new Intl.NumberFormat('en-US');

export const formatNumber = value => format.format(value);

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

/** "price:desc,symbol:asc" to a sort model. */
export const parseSort = value => value
  ? value.split(',').map(key => {
    const [columnId, direction] = key.split(':');
    return { columnId, direction };
  })
  : [];

/** Fonts, and the extra layer and renderer the change column uses. */
export const configureGrid = grid => {
  grid.font = '12px ui-monospace, Menlo, Consolas, monospace';
  grid.headerFont = '600 13px system-ui, sans-serif';
  grid.addLayer('trend', { before: 'header' });
  grid.registerRenderer('trend', trendRenderer);
};

/** Adds the formatters and the trend renderer to the columns the feed describes. */
export const withColumnOptions = columns => columns.map(column => ({
  ...column,
  ...(formatters[column.id] && { valueFormatter: formatters[column.id] }),
  ...(column.id === 'change' && { renderers: ['background', 'value', 'trend'] }),
}));
