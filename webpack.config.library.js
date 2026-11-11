const path = require('path');
const setupConfig = require('./webpack.config.shared.js');

module.exports = setupConfig({
    entry: './src/main.ts',
    output: {
        path: path.resolve(__dirname, './dist/esm'),
        filename: '[name].mjs',
        chunkFilename: "js/[name].[contenthash].mjs",
        clean: true,
        module: true,
        library: {
            type: 'module',
        },
    },
});