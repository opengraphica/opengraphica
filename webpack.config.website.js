const path = require('path');
const setupConfig = require('./webpack.config.shared.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = setupConfig({
    entry: {
        'opengraphica': './src/main-default.js'
    },
    output: {
        path: path.resolve(__dirname, './www'),
        filename: 'js/[name].[contenthash].js',
        chunkFilename: 'js/[name].[contenthash].js',
        library: {
            name: 'OpenGraphica',
            type: 'var'
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'OpenGraphica Image Editor',
            template: 'index.ejs',
            inject: 'head',
            scriptLoading: 'blocking'
        })
    ]
});
