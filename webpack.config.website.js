const fs = require('fs');
const path = require('path');
const setupConfig = require('./webpack.config.shared.js');
const { execSync } = require('child_process');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

class BuildInfoPlugin {
    constructor(options) {
        this.options = {
            outputDir: options.outputDir,
            outputFileName: options.outputFileName || 'package-info',
            ...options
        }
    }
    apply (compiler) {
        compiler.hooks.done.tapAsync('BuildInfoPlugin', (compilation, callback) => {
            const outputPath = path.resolve(compiler.context, this.options.outputDir);
            if(!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath, { recursive: true });
            }
            const outputFile = path.join(outputPath, this.options.outputFileName);
            
            const gitCommitId = execSync('git rev-parse HEAD').toString().trim();

            const buildInfo = {
                gitCommitId,
            }
            fs.writeFileSync(outputFile + '.json', JSON.stringify(buildInfo, null, 4), 'utf8');

            callback();
        });
    }
}

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
        new BuildInfoPlugin({
            outputDir : path.resolve(__dirname, 'www'),
            outputFileName: 'build-info'
        }),
        new HtmlWebpackPlugin({
            title: 'OpenGraphica Image Editor',
            template: 'index.ejs',
            inject: 'head',
            scriptLoading: 'blocking'
        })
    ]
});
