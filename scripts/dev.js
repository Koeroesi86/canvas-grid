const { resolve } = require('path');
const { existsSync } = require('fs');
const { removeSync } = require('fs-extra');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');

process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

if (!process.env.DEV_PORT) {
  process.env.DEV_PORT = '3000';
}

const config = require('../webpack.config');
const exampleServer = require('../server/example');

if (existsSync(resolve(__dirname, '../build'))) {
  removeSync(resolve(__dirname, '../build'))
}

process.on('unhandledRejection', err => {
  throw err
});

const port = process.env.DEV_PORT;
const compiler = webpack(config);
// HMR/live-reload sockets are disabled: the example data server shares this http server's websocket upgrades.
const devServer = new WebpackDevServer({
  ...config.devServer,
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

devServer.start().then(() => {
  console.log(`Starting server on http://localhost:${port}`);
  exampleServer(devServer.server);
});
