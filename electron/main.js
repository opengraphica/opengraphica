const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');

ipcMain.handle('app:quit', () => {
    app.quit();
})

const createWindow = () => {
    const win = new BrowserWindow({
        show: false,
        frame: true,
        // fullscreen: true,
        kiosk: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    win.once("ready-to-show", () => win.show());
    win.loadFile('www/index.html');
}

app.whenReady().then(() => {
    createWindow();
});