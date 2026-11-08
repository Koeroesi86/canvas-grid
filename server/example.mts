import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import type { ServerOptions } from 'ws';

export const EXAMPLE_PATH = '/example';

const rowCount = 500;
const columnCount = 30;

type Row = { id: number } & Record<string, string | number>;

export const createExampleServer = (options: ServerOptions) => {
  console.log('Initialising server');

  const wsServer = new WebSocketServer(options);

  const data = new Map<number, Row>();
  const getRandomValue = () => (Math.random() * 100).toFixed(10).toString();

  const randomText = () => {
    data.forEach((row, id) => {
      Object.keys(row).forEach(key => {
        if (key !== 'id' && Math.random() > 0.99) {
          const value = getRandomValue();
          if (value !== row[key]) {
            data.set(id, { ...row, [key]: value });
            wsServer.clients.forEach(client => {
              client.send(JSON.stringify({ row: { id, [key]: value } }));
            });
          }
        }
      });
    });
  };

  const init = () => {
    // fill up initial data
    for (let r = 0; r <= rowCount; r++) {
      const row: Row = { id: r };
      for (let column = 0; column <= columnCount; column++) {
        row[column] = getRandomValue();
      }
      data.set(r, row);
    }

    setInterval(randomText, 50);
    console.log('Server started');
  };

  wsServer.on('connection', ws => {
    ws.on('message', message => {
      console.log(`Received message => ${message}`)
    });
    const initialData = [...data.values()];
    ws.send(JSON.stringify({ columns: Object.keys(initialData[0]) }));
    ws.send(JSON.stringify({ all: initialData }));
  });

  init();

  return wsServer;
};

/** Serves the example data on `EXAMPLE_PATH` of an existing http server, leaving other upgrades (e.g. Vite HMR) alone. */
interface UpgradeEmitter {
  on(event: 'upgrade', listener: (request: IncomingMessage, socket: Duplex, head: Buffer) => void): unknown;
}

export const attachExampleServer = (server: UpgradeEmitter) => {
  const wsServer = createExampleServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url !== EXAMPLE_PATH) return;
    wsServer.handleUpgrade(request, socket, head, ws => wsServer.emit('connection', ws, request));
  });

  return wsServer;
};
