const path = require('path');
const setupConfig = require('./webpack.config.shared.js');

module.exports = setupConfig({
    entry: './src/main.ts',
    output: {
        path: path.resolve(__dirname, './dist'),
        filename: 'opengraphica.common.js',
        library: {
            type: 'commonjs'
        }
    }
});