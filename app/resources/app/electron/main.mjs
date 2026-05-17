import { app, BrowserWindow, ipcMain, screen, session } from 'electron';
import { fork } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;
let serverProcess = null;

function startServer() {
  const serverEntry = join(__dirname, '..', 'server', 'index.js');
  if (!existsSync(serverEntry)) {
    console.error('Server entry not found:', serverEntry);
    createWindow();
    return;
  }
  serverProcess = fork(serverEntry, [], {
    env: { ...process.env, NODE_ENV: isDev ? 'development' : 'production', PORT: '3001' },
    silent: true,
  });
  serverProcess.stdout.on('data', (d) => {
    const msg = d.toString().trim();
    console.log('[server]', msg);
    if (msg.includes('Server on')) createWindow();
  });
  serverProcess.stderr.on('data', (d) => console.error('[server:err]', d.toString().trim()));
  serverProcess.on('exit', (code) => {
    console.log('[server] exited with code', code);
    createWindow();
  });
  setTimeout(createWindow, 5000);
}

function createWindow() {
  if (mainWindow) return;
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.min(1400, Math.round(screenW * 0.85));
  const h = Math.min(860, Math.round(screenH * 0.85));

  mainWindow = new BrowserWindow({
    width: w, height: h,
    minWidth: 900, minHeight: 600,
    frame: true,
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: true,
  });

  // DevTools disabled in production
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.webContents.on('did-fail-load', (ev, code, desc, url) => {
    console.error('Page load failed:', code, desc, url);
  });

  // Always load from local server to get CSP + runtime patches
  mainWindow.loadURL('http://localhost:3001');

  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

app.whenReady().then(() => {
  // Suppress Electron CSP warning
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' http://localhost:3001; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://fonts.gstatic.font.im; img-src 'self' data:; connect-src 'self' http://localhost:3001 ws://localhost:3001"
        ]
      }
    });
  });
  startServer();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
