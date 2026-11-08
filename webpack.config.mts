import { resolve } from 'node:path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import type { Configuration } from 'webpack';

export type BuildMode = 'development' | 'production';

export const createConfig = (mode: BuildMode): Configuration => {
  const isDev = mode === 'development';

  return {
    mode,
    entry: {
      'web-component': resolve(import.meta.dirname, './components/web-component.ts'),
      ...(isDev && {
        example: resolve(import.meta.dirname, './components/example.ts'),
      }),
    },
    output: {
      library: { type: 'umd' },
      path: resolve(import.meta.dirname, './build'),
      publicPath: '/',
      globalObject: `typeof self !== 'undefined' ? self : this`,
      filename: '[name].js',
    },
    devtool: 'source-map',
    plugins: [
      isDev && new HtmlWebpackPlugin({
        template: resolve(import.meta.dirname, './public/index.html'),
        chunks: ['example'],
      }),
      new webpack.EnvironmentPlugin({
        DEV_PORT: '3000',
      }),
    ].filter(Boolean),
    optimization: {
      minimize: !isDev,
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          options: {
            cacheDirectory: isDev,
          },
        },
        {
          test: /\.(woff(2)?|ttf|eot|svg|png|ico|jpg|webm|mp4)$/,
          type: 'asset/resource',
        },
        {
          test: /\.css$/,
          use: [
            {
              loader: 'style-loader',
              options: {
                injectType: 'singletonStyleTag',
              },
            },
            {
              loader: 'css-loader',
              options: {
                modules: {
                  namedExport: false,
                  exportLocalsConvention: 'as-is',
                  localIdentName: isDev ? '[name]__[local]' : '[hash:base64:4]',
                },
              },
            },
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  };
};
