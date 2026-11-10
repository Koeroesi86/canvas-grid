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

/** The fonts the demo's font picker offers; the value is a CSS font-family. */
export const fontFamilies = {
  'ui-monospace, Menlo, Consolas, monospace': 'Monospace',
  'system-ui, sans-serif': 'System sans-serif',
  'Georgia, "Times New Roman", serif': 'Serif',
  'Caveat, cursive': 'Handwriting (web font)',
};

/** Fills the font picker and applies its choice to the grid. */
export const bindFontPicker = (select, grid) => {
  select.replaceChildren(...Object.entries(fontFamilies).map(([family, label]) => new Option(label, family)));
  select.addEventListener('change', () => applyFontFamily(grid, select.value));
};

/** Sets the font family on the grid's CSS, which the grid inherits, and has it pick the change up. */
export const applyFontFamily = (grid, family) => {
  grid.style.fontFamily = family;
  // the published build may predate inheriting fonts, so tolerate its absence
  grid.refreshFonts?.();
};

/** Fonts, and the extra layer and renderer the change column uses. */
export const configureGrid = grid => {
  grid.style.fontSize = '12px';
  grid.font = 'inherit';
  grid.headerFont = 'inherit';
  applyFontFamily(grid, Object.keys(fontFamilies)[0]);
  grid.addLayer('trend', { before: 'header' });
  grid.registerRenderer('trend', trendRenderer);
};

/** Adds the formatters and the trend renderer to the columns the feed describes. */
export const withColumnOptions = columns => columns.map(column => ({
  ...column,
  ...(formatters[column.id] && { valueFormatter: formatters[column.id] }),
  ...(column.id === 'change' && { renderers: ['background', 'value', 'trend'] }),
}));
