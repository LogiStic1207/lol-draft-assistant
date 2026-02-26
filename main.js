const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let splashWindow = null;

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 480,
        height: 360,
        frame: false,
        transparent: true,
        center: true,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
    });

    splashWindow.loadFile('splash.html');
    splashWindow.on('closed', () => { splashWindow = null; });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        show: false,
        frame: false,
        backgroundColor: '#0b0e14',
        title: 'Draft OS — Hard Fearless',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
    });

    mainWindow.loadFile('index.html');

    // When main window is ready, show it and close splash
    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
            }
            mainWindow.show();
            mainWindow.focus();
        }, 1500);
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// IPC handlers for custom titlebar
ipcMain.on('window-minimize', () => { mainWindow?.minimize(); });
ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
});
ipcMain.on('window-close', () => { mainWindow?.close(); });

// App lifecycle
app.whenReady().then(() => {
    createSplashWindow();
    setTimeout(() => { createMainWindow(); }, 300);
});

app.on('window-all-closed', () => { app.quit(); });

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});
