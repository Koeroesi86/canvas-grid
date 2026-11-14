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
  'system-ui, sans-serif': 'System sans-serif',
  'ui-monospace, Menlo, Consolas, monospace': 'Monospace',
  'Georgia, "Times New Roman", serif': 'Serif',
  'Caveat, cursive': 'Handwriting (web font)',
};

/** Fills the font picker and applies its choice to the grid. */
export const bindFontPicker = (select, grid, onChange) => {
  select.replaceChildren(...Object.entries(fontFamilies).map(([family, label]) => new Option(label, family)));
  select.addEventListener('change', () => {
    applyFontFamily(grid, select.value);
    onChange?.();
  });
};

/** The row count each grid shows, to size its row-number column again when the font changes. */
const rowCounts = new WeakMap();

const measureCanvas = document.createElement('canvas').getContext('2d');

/** Sizes the row-number column to the widest number of the last row, in the font the numbers are drawn with. */
export const fitRowNumbers = (grid, rowCount = rowCounts.get(grid) ?? 0) => {
  rowCounts.set(grid, rowCount);
  const digits = String(rowCount).length;
  const font = grid.headerCellRenderer?.font;
  if (!measureCanvas || !font) return;

  measureCanvas.font = font;
  // the widest digit decides, as proportional fonts differ in digit widths
  const textWidth = Math.max(...'0123456789'.split('').map(digit => measureCanvas.measureText(digit.repeat(digits)).width));
  grid.rowNumbersWidth = Math.ceil(textWidth) + grid.cellPadding.left + grid.cellPadding.right;
};

/** Sets the font family on the grid's CSS, which the grid inherits, and has it pick the change up. */
export const applyFontFamily = (grid, family) => {
  grid.style.fontFamily = family;
  // the published build may predate inheriting fonts, so tolerate its absence
  grid.refreshFonts?.();
  fitRowNumbers(grid);
  grid.resize?.();
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

/** The symbol column keeps its own font whatever the font picker says, to show per-column fonts. */
const symbolFont = '600 12px ui-monospace, Menlo, Consolas, monospace';

/** Adds the formatters and the trend renderer to the columns the feed describes. */
export const withColumnOptions = columns => columns.map(column => ({
  ...column,
  ...(formatters[column.id] && { valueFormatter: formatters[column.id] }),
  ...(column.id === 'symbol' && { font: symbolFont }),
  ...(column.id === 'change' && { renderers: ['background', 'value', 'trend'] }),
}));
