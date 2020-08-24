const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const common = {
	resolve: {
		extensions: ['.wasm', '.ts', '.mjs', '.js', '.json'],
		alias: {
			Renderer: path.resolve(__dirname, 'src/renderer/'),
			Main: path.resolve(__dirname, 'src/renderer/')
		}
	}
}

const rendererConfig = {
	...common,
	mode: 'development',
	target: 'electron-renderer',
	devtool: 'inline-source-map',
	entry: './src/renderer/index.ts',
	output: {
		path: path.resolve(__dirname, 'dist', 'renderer'),
		filename: 'index.js'
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: 'ts-loader'
			},
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: './src/renderer/index.html.ejs'
		})
	]
};

const mainConfig = {
	...common,
	mode: 'development',
	target: 'electron-main',
	entry: './src/main.ts',
	module: {
		rules: [
			{
				test: /\.ts$/,
				loader: 'ts-loader'
			},
		]
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'main.js'
	}
};

module.exports = [ rendererConfig, mainConfig ];
