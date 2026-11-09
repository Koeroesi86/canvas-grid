/** Shared by both modes: one frame of a grid of numbers, drawn with the same calls the real renderers use. */
export const CELL_WIDTH = 100;
export const CELL_HEIGHT = 24;

export interface FrameStats {
  frames: number;
  fps: number;
  frameMedianMs: number;
  frameP95Ms: number;
  drawMeanMs: number;
}

/** Column-major values, like ColumnStore, so a SharedArrayBuffer or transferred buffer could back it. */
export const createValues = (rows: number, columns: number) => {
  const values = new Float64Array(rows * columns);
  values.forEach((_, index) => { values[index] = (index * 7919) % 10007; });
  return values;
};

export const drawGrid = (
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  values: Float64Array,
  rows: number,
  width: number,
  height: number,
  scrollY: number,
) => {
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ddd';
  ctx.font = '12px sans-serif';
  ctx.textBaseline = 'middle';
  const firstRow = Math.floor(scrollY / CELL_HEIGHT);
  const lastRow = Math.min(rows, firstRow + Math.ceil(height / CELL_HEIGHT) + 1);
  const columns = Math.ceil(width / CELL_WIDTH);
  for (let row = firstRow; row < lastRow; row++) {
    const y = row * CELL_HEIGHT - scrollY;
    for (let column = 0; column < columns; column++) {
      ctx.fillText(values[column * rows + row].toFixed(2), column * CELL_WIDTH + 4, y + CELL_HEIGHT / 2);
    }
  }
};

/** Writes `count` random cells, the way a data feed would; returns nothing to keep the hot loop allocation free. */
export const applyUpdates = (values: Float64Array, count: number) => {
  for (let i = 0; i < count; i++) values[(Math.random() * values.length) | 0] = Math.random() * 10000;
};

export const summarise = (deltas: number[], draws: number[]): FrameStats => {
  const sorted = deltas.slice(1).sort((a, b) => a - b);
  const total = sorted.reduce((sum, delta) => sum + delta, 0);
  return {
    frames: sorted.length,
    fps: sorted.length / (total / 1000),
    frameMedianMs: sorted[Math.floor(sorted.length / 2)],
    frameP95Ms: sorted[Math.floor(sorted.length * 0.95)],
    drawMeanMs: draws.reduce((sum, draw) => sum + draw, 0) / draws.length,
  };
};
