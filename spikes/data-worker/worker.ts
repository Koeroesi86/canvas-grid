import { applyChanges, createRows, createStore, loadRows, readWindow, sortBy } from './ops';

const store = createStore();

interface Request {
  id: number;
  type: 'generate' | 'load' | 'update' | 'sort' | 'window';
  rows?: number;
  data?: Parameters<typeof loadRows>[1];
  changes?: Parameters<typeof applyChanges>[1];
  columnId?: string;
  from?: number;
  to?: number;
}

self.onmessage = ({ data: request }: MessageEvent<Request>) => {
  const start = performance.now();
  const reply = (payload?: unknown, transfer: Transferable[] = []) => {
    postMessage({ id: request.id, computeMs: performance.now() - start, payload }, transfer);
  };
  switch (request.type) {
    case 'generate':
      loadRows(store, createRows(request.rows ?? 0));
      return reply();
    case 'load':
      loadRows(store, request.data ?? []);
      return reply();
    case 'update':
      applyChanges(store, request.changes ?? []);
      return reply();
    case 'sort': {
      const order = sortBy(store, request.columnId);
      return reply(order, [order.buffer]);
    }
    case 'window':
      return reply(readWindow(store, request.from ?? 0, request.to ?? 0));
  }
};
