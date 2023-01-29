var fs = require('fs');
var postcss = require('postcss');
var pxtorem = require('postcss-pxtorem');
var prefixer = require('postcss-prefix-selector');
var lightCss = fs.readFileSync('element-plus-theme-chalk-original.css', 'utf8');
// var darkCss = fs.readFileSync('element-plus-theme-dark-original.css', 'utf8');
var options = {
    propList: ['*'],
    replace: true
};

const stylesheets = [
    {
        css: lightCss,
        filename: 'element-plus-theme-chalk.css'
    }
];

for (let { css, filename } of stylesheets) {
    var processedCss = postcss()
        .use(pxtorem(options))
        .use(prefixer({
            prefix: '.opengraphica'
        }))
        .process(css).css
        .replace(/\.opengraphica \:root\{/g, '.opengraphica{')
        .replace(/\[x\-placement\^\=/g, '[data-popper-placement^=')
        .replace(/\.popper\_\_arrow/g, '.el-popper__arrow');

    fs.writeFile(filename, processedCss, function (err) {
        if (err) {
            throw err;
        }
    });
}