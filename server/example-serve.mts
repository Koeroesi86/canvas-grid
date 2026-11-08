import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { attachExampleServer } from './example.mts';

if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.DEV_PORT || '3000');
const server = createServer();

attachExampleServer(server);
server.listen(port, () => console.log(`Example data server on ws://localhost:${port}/example`));
