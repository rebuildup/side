const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_PORT = Number(process.env.DECK_IDE_PORT || 8787);
const SERVER_URL_FALLBACK = `http://localhost:${DEFAULT_PORT}`;

let mainWindow = null;
let serverProcess = null;
let serverUrl = SERVER_URL_FALLBACK;
let lastError = '';
let logFilePath = '';
const logBuffer = [];
const LOG_LINE_LIMIT = 400;

const resolveServerEntry = () => {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'server', 'index.js');
  }
  return path.resolve(__dirname, '..', '..', 'server', 'dist', 'index.js');
};

const resolveNodeBinary = () =>
  process.env.DECK_IDE_NODE || process.execPath;

const getNodePath = () => {
  const candidates = [
    path.join(app.getAppPath(), 'node_modules'),
    path.join(process.resourcesPath, 'node_modules')
  ];
  return candidates
    .filter((candidate) => fs.existsSync(candidate))
    .join(path.delimiter);
};

const getDbPath = () => {
  const base = app.getPath('userData');
  return path.join(base, 'data', 'deck-ide.db');
};

const getServerStatus = () => ({
  running: Boolean(serverProcess),
  url: serverUrl,
  lastError,
  autoStart: app.getLoginItemSettings().openAtLogin
});

const broadcastStatus = () => {
  if (!mainWindow) return;
  mainWindow.webContents.send('server-status', getServerStatus());
};

const appendLog = (text) => {
  if (!text) return;
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  lines.forEach((line, index) => {
    if (line === '' && index === lines.length - 1) return;
    logBuffer.push(line);
  });
  if (logBuffer.length > LOG_LINE_LIMIT) {
    logBuffer.splice(0, logBuffer.length - LOG_LINE_LIMIT);
  }
  if (logFilePath) {
    fs.appendFile(logFilePath, `${normalized}`, () => undefined);
  }
  if (mainWindow) {
    mainWindow.webContents.send('server-log', normalized);
  }
};

const parseServerUrl = (text) => {
  const match = text.match(/Deck IDE server listening on (http[^\s]+)/);
  if (match) {
    serverUrl = match[1];
  }
};

const startServer = () => {
  if (serverProcess) {
    return;
  }
  const entry = resolveServerEntry();
  if (!fs.existsSync(entry)) {
    lastError = `Server entry not found: ${entry}`;
    broadcastStatus();
    return;
  }
  lastError = '';
  const nodeBinary = resolveNodeBinary();
  const env = {
    ...process.env,
    PORT: String(DEFAULT_PORT),
    NODE_PATH: getNodePath(),
    DB_PATH: getDbPath()
  };
  if (nodeBinary === process.execPath) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }
  serverProcess = spawn(nodeBinary, [entry], {
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.on('error', (error) => {
    lastError = error.message;
    serverProcess = null;
    broadcastStatus();
  });
  serverProcess.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    appendLog(text);
    parseServerUrl(text);
    broadcastStatus();
  });
  serverProcess.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    appendLog(text);
    lastError = text.trim();
    broadcastStatus();
  });
  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (code && code !== 0) {
      lastError = `Server exited with code ${code}`;
    }
    appendLog(`\n${lastError || 'Server stopped.'}\n`);
    broadcastStatus();
  });
  appendLog(`\nStarting server with ${nodeBinary}...\n`);
  broadcastStatus();
};

const stopServer = () => {
  if (!serverProcess) {
    return;
  }
  serverProcess.kill();
  serverProcess = null;
  appendLog('\nStop requested.\n');
  broadcastStatus();
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 320,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  const logDir = app.getPath('userData');
  logFilePath = path.join(logDir, 'server.log');
  createWindow();
  startServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});

ipcMain.handle('server-info', () => getServerStatus());
ipcMain.handle('server-logs', () => logBuffer.join('\n'));
ipcMain.handle('logs-clear', () => {
  logBuffer.length = 0;
  if (logFilePath) {
    fs.writeFileSync(logFilePath, '');
  }
  return logBuffer.join('\n');
});
ipcMain.handle('server-start', () => {
  startServer();
  return getServerStatus();
});
ipcMain.handle('server-stop', () => {
  stopServer();
  return getServerStatus();
});
ipcMain.handle('server-open', () => {
  shell.openExternal(serverUrl);
  return getServerStatus();
});
ipcMain.handle('autostart-set', (_, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    openAsHidden: true
  });
  return getServerStatus();
});
