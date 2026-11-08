import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import webpack from 'webpack';
import { createConfig } from '../webpack.config.mts';

process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

dotenv.config({ quiet: true });

rmSync(resolve(import.meta.dirname, '../build'), { recursive: true, force: true });

process.on('unhandledRejection', err => {
  throw err;
});

webpack(createConfig('production'), (err, stats) => {
  if (err || !stats) {
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
