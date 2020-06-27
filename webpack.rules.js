module.exports = [
  // Add support for native node modules
  {
    test: /\.node$/,
    use: 'node-loader',
  },
  {
    test: /\.(m?js|node)$/,
    parser: {amd: false},
    use: {
      loader: '@marshallofsound/webpack-asset-relocator-loader',
      options: {
        outputAssetBase: 'native_modules',
      },
    },
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|.webpack)/,
    loaders: [
      {
        loader: 'awesome-typescript-loader',
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
  {
    test: /\.tsx?$/,
    exclude: /(node_modules|.webpack)/,
    loaders: [
      {
        loader: 'tslint-loader',
        options: {
          tsConfigFile: 'tsconfig.json',
          typeCheck: true,
          formatter: 'verbose',
        },
      },
    ],
  },
  {
    test: /\.(png|ico|svg|jpg|gif|icns)$/,
    use: [
      {
        loader: 'file-loader',
        options: {
          name: './statics/[name].[ext]',
        },
      },
    ],
  },
];
