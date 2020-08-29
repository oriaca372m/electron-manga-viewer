const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const common = {
	resolve: {
		extensions: ['.wasm', '.ts', '.mjs', '.js', '.json'],
		alias: {
			Src: path.resolve(__dirname, 'src/'),
			Renderer: path.resolve(__dirname, 'src/renderer/')
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
		filename: 'index.js',
		path: path.resolve(__dirname, 'dist', 'renderer')
	},
	module: {
		rules: [
			{
				enforce: 'pre',
				test: /\.(ts|js)$/,
				exclude: /node_modules/,
				loader: 'eslint-loader',
				options: {
					fix: true
				}
			},
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
	output: {
		filename: 'main.js',
		path: path.resolve(__dirname, 'dist')
	},
	module: {
		rules: [
			{
				enforce: 'pre',
				test: /\.(ts|js)$/,
				exclude: /node_modules/,
				loader: 'eslint-loader',
				options: {
					fix: true
				}
			},
			{
				test: /\.ts$/,
				loader: 'ts-loader'
			},
		]
	}
};

module.exports = [ rendererConfig, mainConfig ];
