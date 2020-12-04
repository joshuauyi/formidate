const path = require('path');

module.exports = {
  entry: './lib/index.js',
  // devtool: 'source-map',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'formidate.min.js',
  },
};
