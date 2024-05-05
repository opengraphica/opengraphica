const fs = require('fs');
const path = require('path');
const sass = require('sass');

const lightThemeResult = sass.renderSync({ file: path.resolve(__dirname, 'main-light.scss') });
fs.writeFileSync(path.resolve(__dirname, 'main-light.css'), lightThemeResult.css);

const darkThemeResult = sass.renderSync({ file: path.resolve(__dirname, 'main-dark.scss') });
fs.writeFileSync(path.resolve(__dirname, 'main-dark.css'), darkThemeResult.css);
