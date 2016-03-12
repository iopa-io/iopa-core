var webpack = require('webpack');

module.exports = {
  entry: './src/index.js',
   target: 'node',
  output: {
    filename: './dest/iopa-core.js',
       "libraryTarget": "commonjs2"   
  },  
  	module: {
		loaders: [
			{ test: /\.json$/, loader: "json" }
		]
	}
};