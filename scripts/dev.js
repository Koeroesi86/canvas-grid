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
const devServerOptions = Object.assign({}, config.devServer, {
  open: false,
  inline: false,
  hot: true,
  compress: true,
  historyApiFallback: true,
  // noInfo: true,
  overlay: {
    warnings: false,
    errors: true
  },
  watchOptions: {
    aggregateTimeout: 300,
    poll: 1000
  },
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
  // before: app => {
  // }
});
const devServer = new WebpackDevServer(compiler, devServerOptions);
const httpServer = devServer.listen(port, '0.0.0.0', () => {
  console.log(`Starting server on http://localhost:${port}`);
});
exampleServer(httpServer);
