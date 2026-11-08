import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import { createConfig } from '../webpack.config.mts';
import exampleServer from '../server/example.mts';

process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';
process.env.DEV_PORT ||= '3000';

rmSync(resolve(import.meta.dirname, '../build'), { recursive: true, force: true });

process.on('unhandledRejection', err => {
  throw err;
});

const port = Number(process.env.DEV_PORT);
const compiler = webpack(createConfig('development'));
// HMR/live-reload sockets are disabled: the example data server shares this http server's websocket upgrades.
const devServer = new WebpackDevServer({
  host: '0.0.0.0',
  port,
  open: false,
  hot: false,
  liveReload: false,
  client: false,
  webSocketServer: false,
  compress: true,
  historyApiFallback: true,
  devMiddleware: {
    stats: {
      builtAt: true,
      hash: false,
      version: false,
      chunks: false,
      colors: true,
      assets: false,
      children: false,
      entrypoints: false,
      modules: false,
      errors: true,
      errorDetails: true,
      performance: true,
      warnings: true,
    },
  },
}, compiler);

await devServer.start();
console.log(`Starting server on http://localhost:${port}`);
exampleServer(devServer.server);
