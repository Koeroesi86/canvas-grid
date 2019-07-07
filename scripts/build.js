const { resolve } = require('path');
const { existsSync } = require('fs');
const { removeSync } = require('fs-extra');
const webpack = require('webpack');

process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

require('dotenv').config();

const config = require('../webpack.config');

if (existsSync(resolve(__dirname, '../build'))) {
  removeSync(resolve(__dirname, '../build'))
}

process.on('unhandledRejection', err => {
  throw err
});

const logger = (err, stats) => {
  console.log(stats.toString({
    colors: true,
    errors: true,
    errorDetails: true,
    warnings: true,
  }));
};

webpack(config, logger);
