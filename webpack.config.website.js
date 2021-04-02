const path = require('path');
const setupConfig = require('./webpack.config.shared.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = setupConfig({
    entry: {
        'opengraphica': './src/main-default.js'
    },
    output: {
        path: path.resolve(__dirname, './www'),
        filename: 'js/[name].js',
        chunkFilename: 'js/[name].js',
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
