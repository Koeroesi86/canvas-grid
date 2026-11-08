const { resolve } = require('path');
const { existsSync } = require('fs');
const { removeSync } = require('fs-extra');
const webpack = require('webpack');

process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

require('dotenv').config({ quiet: true });

const config = require('../webpack.config');

if (existsSync(resolve(__dirname, '../build'))) {
  removeSync(resolve(__dirname, '../build'))
}

process.on('unhandledRejection', err => {
  throw err
});

webpack(config, (err, stats) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  console.log(stats.toString({
    colors: true,
    errors: true,
    errorDetails: true,
    warnings: true,
  }));

  if (stats.hasErrors()) {
    process.exit(1);
  }
});
