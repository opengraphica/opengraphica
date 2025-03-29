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
    devtool: 'eval-cheap-source-map',
    devServer: {
        static: path.join(__dirname, './dev'),
        host: '0.0.0.0',
        hot: true,
        port: 8080,
        allowedHosts: 'all'
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

module.exports.module.rules.push({
    test: /\.(woff|woff2|eot|ttf|otf)$/i,
    type: 'asset/resource',
});
module.exports.module.rules.push({
    test: /\.s[ac]ss$/i,
    include: path.resolve(__dirname, 'src'),
    use: [
        'style-loader',
        'css-loader',
        {
            loader: 'sass-loader',
            options: {
                // Prefer `dart-sass`
                implementation: require('sass'),
                sassOptions: {
                    includePaths: [path.resolve(__dirname, './src')],
                },
            }
        }
    ]
});
