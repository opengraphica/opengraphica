# OpenGraphica

OpenGraphica is a raster and vector image editing program that runs in your web browser. It is free to use and open source under the MIT license, and works as an alternative to Photoshop for most common photo editing tasks.

Use OpenGraphica at https://opengraphica.com/

## User Guide

Visit the [Wiki page on github](https://github.com/opengraphica/opengraphica/wiki) for all sorts of information from how to use the application, to deployment and development.

## Deployment

OpenGraphica may be integrated into existing web applications which require a photo editor.

### Single-Page Apps

If you have an existing app in **Angular, React, Vue, Svelte**, etc. where you want to add OpenGraphica as a photo editor, it is easiest to install OpenGraphica as a NPM package and import it into your application.

This build packages OpenGraphica as ECMAScript Modules, so your bundler (Vite, Webpack) must be configured to import ESM modules.

Install OpenGraphica in your project:

```sh
npm install opengraphica
```

Import the app and mount it on your page:

```js
import OpenGraphica from 'opengraphica';

// Tell OpenGraphica where to load is assets from (editor images and other things).
// This path depends on how your bundler is configured.
OpenGraphica.emit('store.setPreference', { key: 'assetsBasePath', value: '/' });

// Replace this with your logic. OpenGraphica will fill the width/height of whatever element you place it inside of.
const container = document.createElement('div');
container.style.display = 'flex';
container.style.position = 'relative';
container.style.width = '500px';
container.style.height = '500px';
document.body.append(container);
OpenGraphica.mount(container);

// Configure which CSS themes to use.
OpenGraphica.theme({
    light: '/css/main-light.css',
    dark: '/css/main-dark.css',
});
```

OpenGraphica is a Vue 3 application, and you can [see the Vue 3 documentation](https://v3.vuejs.org/guide/migration/global-api.html#mounting-app-instance) for complete details on working with a Vue 3 app.

Note that OpenGraphica is only designed to have a  **single instance running** on a page.


### Static Content Site

Website builds are distributed on the [releases page on GitHub](https://github.com/opengraphica/opengraphica/releases).

For simple deployment on a static web server like **Apache or Nginx**, you can extract the contents of the web build to any folder inside of your website's filesystem. It has a `index.html` file which will load the OpenGraphica image editor.

## Contributing

**__By submitting a pull request for this project, you agree to license your contribution under the MIT license to this project.__**

All commands assume you are operating in a Linux-like environment. If you're on Windows, inspect the commands in the package.json and run equivalent Windows commands.

### Development Workspace Setup

1. Install [Node.js](https://nodejs.org/en/)
2. Install [Rust](https://rust-lang.org/)
3. Clone this repository:

```sh
git clone https://github.com/opengraphica/opengraphica.git
```

4. Go into the repository directory, and install Node.js modules:
    
```sh
cd opengraphica
npm install
```

### Web Assembly Builds

Rust is used to create some web assembly code.

Web assembly builds are not committed to the source repository, so before you do anything, you need to build them.

In the root folder of the project, run:

```sh
npm run build:wasm
```

This command will build the rust code as web assembly modules, then set up some symbolic links to the rust build pkg folders inside of various places in the `src` folder that contains the main application Javascript code.

### Development Server

Start the development server with this command:

```sh
npm run dev
```

Then open the link `http://localhost:8080/` in any web browser.

CSS files are packaged separately. After modifying any file under the `src/css` directory, run:

```
npm run build:css
```

Afterwards, you may have to refresh your dev server manually to see changes.

### Release Builds

**Build OpenGraphica as a standalone website:**
```
npm run build:website
```
The result is stored in the `www` directory.

**Build OpenGraphica as a 3rd party library for consumption in 1st party applications (e.g. Angular/Vue):**
```
npm run build:library
```
The result is stored in the `dist` directory.

**Build OpenGraphica as an Android app:**
```
npm run build:android
npx cap open android
```
You must have Android Studio installed. This will prepare the project for Android Studio to take over and either build an `.apk` file or run it on a phone.

**Build OpenGraphica as an Ubuntu Touch app:**
```
npm run build:clickable
```
The resulting `.click` is stored in the `build/all/app` folder.

## AI Policy

**AI is <u>not</u> used by the core OpenGraphica maintainers to generate code.**

This project relies on [LibreTranslate](https://libretranslate.com/) to provide machine translation placeholders for languages other than English. If you have better translations, please contribute!

If you open a pull request that is assisted by an AI agent, it is expected that **you personally understand** every line of code in the pull request.

Please do not use AI as a shortcut to vibe code a feature you want and submit it as a pull request. This can lead to unexpected copyright and license violations. These pull requests will not be accepted.

OpenGraphica has a [plugin system](https://github.com/opengraphica/opengraphica/wiki/Plugin-API) for extending editor functionality if you wish to experiment with vibe coding a feature outside of the main codebase. Plugins are manually installed by the end user of OpenGraphica, and are not distributed in this repository.