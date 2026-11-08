import type { Server } from 'node:http';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';

dotenv.config({ quiet: true });

const rowCount = 500;
const columnCount = 30;

type Row = { id: number } & Record<string, string | number>;

export default (server?: Server) => {
  console.log('Initialising server');

  const wsServer = new WebSocketServer(server ? { server } : { port: Number(process.env.DEV_PORT || '3000') });

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
};
