const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const isDev = process.env.NODE_ENV === 'development';

const config = {
  mode: isDev ? 'development' : 'production',
  entry: {
    'web-component': path.resolve(__dirname, './components/web-component.js'),
    ...(isDev && {
      example: path.resolve(__dirname, './components/example.js'),
    }),
  },
  output: {
    library: { type: 'umd' },
    path: path.resolve(__dirname, './build'),
    publicPath: '/',
    globalObject: `typeof self !== 'undefined' ? self : this`,
    filename: '[name].js'
  },
  devtool: 'source-map',
  plugins: [
    isDev && new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './public/index.html'),
      chunks: ['example'],
    }),
    new webpack.EnvironmentPlugin({
      DEV_PORT: '3000'
    }),
  ].filter(Boolean),
  optimization: {
    minimize: !isDev,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {
          cacheDirectory: isDev
        }
      },
      {
        test: /\.(woff(2)?|ttf|eot|svg|png|ico|jpg|webm|mp4)$/,
        type: 'asset/resource'
      },
      {
        test: /\.(sa|sc|c)ss$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              injectType: 'singletonStyleTag',
            }
          },
          {
            loader: 'css-loader',
            options: {
              modules: {
                namedExport: false,
                exportLocalsConvention: 'as-is',
                localIdentName: process.env.NODE_ENV === 'production' ? '[hash:base64:4]' : '[name]__[local]',
              },
              importLoaders: 1,
            }
          },
          {
            loader: 'sass-loader'
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json']
  }
};


module.exports = config;
