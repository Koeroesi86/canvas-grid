const WebSocket = require('ws');

require('dotenv').config();

const rowCount = 200;
const columnCount = 20;

module.exports = (server) => {
  console.log('Initialising server');

  const wsServer = new WebSocket.Server(server ? { server } : { port: process.env.DEV_PORT || '3000' });

  const data = new Map();
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
      const row = { id: r };
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
    const initialData = [];
    data.forEach(row => {
      initialData.push(row);
    });
    ws.send(JSON.stringify({ columns: Object.keys(initialData[0]) }));
    ws.send(JSON.stringify({ all: initialData }));
  });

  init();
};
