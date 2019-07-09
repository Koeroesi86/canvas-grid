const { resolve } = require('path');
const { existsSync } = require('fs');
const { removeSync } = require('fs-extra');
const { execSync } = require('child_process');
const webpack = require('webpack');

process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

require('dotenv').config();

const config = require('../webpack.config');

if (existsSync(resolve(__dirname, '../build'))) {
  removeSync(resolve(__dirname, '../build'))
}

const { TRAVIS_TAG, TRAVIS_BUILD_NUMBER } = process.env;
const version = `1.0.${(TRAVIS_BUILD_NUMBER || '1').padStart(3, '0')}-${TRAVIS_TAG}`;
execSync(`export VERSION=${version}`);

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
