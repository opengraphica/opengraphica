const path = require('path');
const webpack = require('webpack');
const setupConfig = require('./webpack.config.shared.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = setupConfig({
    mode: 'development',
    entry: './src/main-default.js',
    output: {
        path: path.resolve(__dirname, './dev'),
        library: {
            name: 'OpenGraphica',
            type: 'var'
        }
    },
    devServer: {
        contentBase: path.join(__dirname, './dev'),
        host: '0.0.0.0',
        hot: true,
        port: 8080,
        disableHostCheck: true
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: 'index.dev.ejs',
            inject: true
        })
    ]
});
