# OpenGraphica

OpenGraphica is an upcoming raster and vector image editing program that runs in your web browser. It is free to use and open source under the MIT license, and works as an alternative to Photoshop for most common photo editing tasks.

**NOTE: OpenGraphica is in very early development, many features display but do nothing when clicked.**

Use OpenGraphica at https://opengraphica.com/

## User Guide

Visit the [Wiki page on github](https://github.com/opengraphica/opengraphica/wiki) for all sorts of information from how to use the application, to deployment and development.

## Deployment

OpenGraphica may be integrated into existing web applications which require a photo editor.

To build OpenGraphica as a website: install [Node.js](https://nodejs.org/en/), clone this repository, then run these Node.js commands in the repository folder:
```
npm install
npm run build:website
```
Production-ready files will output in the `www` folder. You may view the index.html in this folder as an example of how to instantiate the app if you wish to tweak it.

```
<!-- OpenGraphica initialization example -->
<!DOCTYPE html>
<html>
    <head>
        <script src="js/vendors.js">
        <script src="js/opengraphica.js">
    </head>
    <body class="og-full-page">
        <div id="opengraphica"></div>
        <script>
            OpenGraphica.theme({
                light: './css/main-light.css',
                dark: './css/main-dark.css'
            }).then(() => {
                OpenGraphica.mount('#opengraphica');
            });
        </script>
    </body>
</html>
```

As shown in the example above, you must first configure OpenGraphica with the the list of themes that the user will be able to pick from. The theme URLs are relative to the index.html page.

Afterwards, the "mount" method tells OpenGraphica where it should be placed in the DOM. OpenGraphica is a Vue 3 application, and you can [view the Vue 3 documentation](https://v3.vuejs.org/guide/migration/global-api.html#mounting-app-instance) for complete details on working with a Vue 3 app.

## Contributing

**__By submitting a pull request for this project, you agree to license your contribution under the MIT license to this project.__**

### Development Workspace Setup

1. Clone this repository and install [Node.js](https://nodejs.org/en/)
2. Open a terminal in the repository directory, and run:
    
    `npm install`

### Development Server

Start the development server with this command:

```
npm run dev
```

Then open the link `http://localhost:8080/` in any web browser.

CSS files are packaged separately. After modifying any file under the `src/css` directory, run:

```
npm run build:css
```

Afterwards, you may have to refresh your dev server manually to see changes.

### Release Builds

Build OpenGraphica as a standalone website:
```
npm run build:website
```
The result is stored in the `www` directory.

Build OpenGraphica as a 3rd party library for consumption in 1st party applications (e.g. Angular/Vue):
```
npm run build:library
```
The result is stored in the `dist` directory.
