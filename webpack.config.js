const path = require('path');
const StaticSiteGeneratorPlugin = require('static-site-generator-webpack-plugin');
const webpack = require('webpack');
const WebpackBar = require('webpackbar');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

const isDev = process.env.NODE_ENV === 'development';

const config = {
  mode: isDev ? 'development' : 'production',
  entry: {
    index: path.resolve(__dirname, './components/index.js'),
    example:  [
      isDev && `webpack-dev-server/client?http://localhost:${process.env.DEV_PORT}`,
      // isDev && 'webpack/hot/only-dev-server',
      isDev && 'webpack/hot/dev-server',
      path.resolve(__dirname, './components/example.js'),
    ].filter(Boolean),
    htmlGenerator: path.resolve(__dirname, './config/htmlGenerator.js'),
  },
  output: {
    pathinfo: true,
    libraryTarget: 'umd',
    path: path.resolve(__dirname, './build'),
    publicPath: '/',
    globalObject: `typeof self !== 'undefined' ? self : this`,
    filename: '[name].js'
  },
  plugins: [
    // new MiniCssExtractPlugin({
    //   filename: isDev ? '[name].css' : '[name].[hash].css',
    //   chunkFilename: isDev ? '[id].css' : '[id].[hash].css',
    // }),
    new StaticSiteGeneratorPlugin({
      entry: 'htmlGenerator',
      paths: [
        '/',
        '/index.html'
      ],
      locals: {
      }
    }),
    // new WebpackBar({
    //   name: "Assets",
    //   color: 'green'
    // }),
    new webpack.SourceMapDevToolPlugin({
      test: /\.(js)/,
      module: true,
      filename: '[file].map',
    }),
    new webpack.EnvironmentPlugin({
      DEV_PORT: '3000'
    }),
    isDev && new webpack.HotModuleReplacementPlugin({
      multiStep: false,
    }),
    isDev && new webpack.NamedModulesPlugin(),
  ].filter(Boolean),
  optimization: {
    minimize: true,
    minimizer: [new UglifyJsPlugin({
      sourceMap: true,
      parallel: true,
      // uglifyOptions: {
      //   compress: false,
      //   output: {
      //     comments: false
      //   }
      // }
    })]
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          cacheDirectory: isDev
        }
      },
      // {
      //   test: /\.(svg|png|jpg|webm|mp4|woff|woff2|ttf|eot)$/,
      //   loader: 'url-loader'
      // },
      // fonts/fonts/components/player-home/fonts/fonts/open-sans-regular.woff2
      // http://localhost:3000/assets/components/player-home/fonts/fonts/open-sans-regular.woff2
      {
        test: /\.(woff(2)?|ttf|eot)$/,
        use: [{
          loader: 'file-loader',
          options: {
            name: '[name]-[hash].[ext]',
            useRelativePath: true,
            outputPath: 'fonts/',
            publicPath: 'fonts/'
          }
        }]
      },
      {
        test: /\.(svg|png|ico|jpg|webm|mp4)$/,
        loader: 'file-loader',
        options: {
          name: '[name]-[hash].[ext]',
          useRelativePath: true,
          outputPath: 'assets/',
          publicPath: 'assets/'
        }
      },
      {
        test: /\.(sa|sc|c)ss$/,
        use: [
          {
            loader: 'style-loader',
            options: {
              sourceMap: process.env.NODE_ENV !== 'production',
              singleton: true,
            }
          },
          // {
          //   loader: MiniCssExtractPlugin.loader,
          //   options: {
          //     hmr: false,
          //     reloadAll: true,
          //   }
          // },
          {
            loader: 'css-loader',
            options: {
              modules: true,
              importLoaders: 1,
              localIdentName: (process.env.NODE_ENV === 'production' ? '[sha1:hash:hex:4]' : '[name]__[local]')
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
