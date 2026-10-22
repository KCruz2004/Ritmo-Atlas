// Proceso principal: controla únicamente ventanas locales.
const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');
function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 820, minWidth: 760, minHeight: 600,
    title: "Ritmo-Atlas", icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.loadFile(path.join(__dirname, 'src/index.html'));
}
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
