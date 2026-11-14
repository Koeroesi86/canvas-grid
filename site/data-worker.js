// Simulated market data feed. Runs off the main thread and posts the initial dataset, then batches of ticks.
const TICK_MS = 50;

const columns = [
  { id: 'symbol', displayName: 'Symbol', width: 90 },
  { id: 'name', displayName: 'Company', width: 200 },
  { id: 'sector', displayName: 'Sector', width: 130 },
  { id: 'price', displayName: 'Price', width: 100 },
  { id: 'change', displayName: 'Change', width: 100 },
  { id: 'bid', displayName: 'Bid', width: 100 },
  { id: 'ask', displayName: 'Ask', width: 100 },
  { id: 'volume', displayName: 'Volume', width: 120 },
  { id: 'high', displayName: 'High', width: 100 },
  { id: 'low', displayName: 'Low', width: 100 },
];

const sectors = ['Energy', 'Finance', 'Health', 'Industrial', 'Materials', 'Retail', 'Tech', 'Utilities'];
const prefixes = ['Alpha', 'Blue', 'Cedar', 'Delta', 'Ember', 'Falcon', 'Granite', 'Harbor', 'Iron', 'Juniper', 'Krypton', 'Lumen', 'Maple', 'Nova', 'Orbit', 'Pioneer'];
const suffixes = ['Systems', 'Holdings', 'Labs', 'Capital', 'Dynamics', 'Networks', 'Partners', 'Works'];
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

let rows = [];
let updatesPerSecond = 500;
let paused = false;

const random = (min, max) => min + Math.random() * (max - min);
const pick = list => list[Math.floor(Math.random() * list.length)];
const round = value => Math.round(value * 100) / 100;

const symbolAt = index => {
  let rest = index;
  let symbol = '';
  for (let i = 0; i < 4; i++) {
    symbol = letters[rest % 26] + symbol;
    rest = Math.floor(rest / 26);
  }
  return symbol;
};

const createRow = id => {
  const price = round(random(5, 500));
  return {
    id,
    symbol: symbolAt(id),
    name: `${pick(prefixes)} ${pick(suffixes)}`,
    sector: pick(sectors),
    price,
    open: price,
    change: 0,
    bid: round(price - 0.01),
    ask: round(price + 0.01),
    volume: Math.floor(random(1e4, 5e6)),
    high: price,
    low: price,
  };
};

// Moves a row's price by a small random step; returns only the cells that changed.
const tick = row => {
  const price = Math.max(0.5, round(row.price * (1 + random(-0.004, 0.004))));
  row.price = price;
  row.high = Math.max(row.high, price);
  row.low = Math.min(row.low, price);
  row.volume += Math.floor(random(1, 5000));
  row.change = round(((price - row.open) / row.open) * 100);
  return {
    id: row.id,
    price,
    change: row.change,
    bid: round(price - 0.01),
    ask: round(price + 0.01),
    volume: row.volume,
    high: row.high,
    low: row.low,
  };
};

const sendTicks = () => {
  if (paused || rows.length === 0) return;

  const count = Math.max(1, Math.round((updatesPerSecond * TICK_MS) / 1000));
  const updates = Array.from({ length: count }, () => tick(rows[Math.floor(Math.random() * rows.length)]));
  postMessage({ type: 'ticks', rows: updates });
};

const start = rowCount => {
  rows = Array.from({ length: rowCount }, (_, id) => createRow(id));
  postMessage({ type: 'init', columns, rows });
};

addEventListener('message', ({ data }) => {
  if (data.type === 'start') start(data.rows);
  if (data.type === 'rate') updatesPerSecond = data.updatesPerSecond;
  if (data.type === 'pause') paused = data.paused;
});

setInterval(sendTicks, TICK_MS);
