import './web-component';
import type { RowInput } from './types';

interface ServerMessage {
  columns: string[];
  all: RowInput[];
  row: RowInput;
}

const init = () => {
  const canvasGrid = document.querySelector('canvas-grid');
  if (!canvasGrid) throw new Error('canvas-grid element not found');

  canvasGrid.font = '12px "Roboto", sans-serif';
  canvasGrid.headerFont = '13px "Roboto", sans-serif';

  const ws = new WebSocket(`ws://localhost:${process.env.DEV_PORT || 3000}`);
  ws.addEventListener('message', e => {
    try {
      const data: Partial<ServerMessage> = JSON.parse(e.data);
      if (data.columns && Array.isArray(data.columns)) {
        canvasGrid.setColumns(data.columns);
      }
      if (data.all) {
        canvasGrid.setValues(data.all);
      }
      if (data.row) {
        canvasGrid.queueUpdate(data.row)
      }
    } catch (e) {
      console.error(e)
    }
  });
  ws.addEventListener('close', () => {
    console.log('Connection closed, reconnecting...');
    setTimeout(init, 1000)
  });
  ws.addEventListener('error', e => {
    console.log('error', e);
  });
};

window.addEventListener('load', init);
