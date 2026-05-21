import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { BackendService } from './backend/service';
import { JsonStore } from './backend/store';

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null = null;
let backend: BackendService;

function sendLog(message: string) {
  win?.webContents.send('log-message', message);
}

function getBackend(): BackendService {
  if (!backend) {
    const store = new JsonStore(path.join(app.getPath('userData'), 'newapi-sync-data.json'));
    backend = new BackendService(store, sendLog);
  }
  return backend;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0F141B',
    title: 'NewAPI 多站点模型价格同步工具',
  });

  win.webContents.on('did-finish-load', () => {
    sendLog(`[INFO] Electron 主进程启动就绪。`);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('ping', () => 'pong');

ipcMain.handle('sites:list', async () => getBackend().listSites());

ipcMain.handle('sites:add', async (_event, siteData) => getBackend().addSite(siteData));

ipcMain.handle('sites:edit', async (_event, siteId, siteData) => getBackend().editSite(siteId, siteData));

ipcMain.handle('sites:test', async (_event, siteId) => getBackend().testSite(siteId));

ipcMain.handle('models:load', async (_event, siteId) => getBackend().loadSiteModels(siteId));

ipcMain.handle('pricing:updateLocal', async (_event, siteId, modelName, pricingData) =>
  getBackend().updateModelPricingLocal(siteId, modelName, pricingData),
);

ipcMain.handle('pricing:previewSync', async (_event, sourceSiteId, targetSiteIds, modelNames, pricingPayload) =>
  getBackend().previewSync(sourceSiteId, targetSiteIds, modelNames, pricingPayload),
);

ipcMain.handle('pricing:executeSync', async (_event, syncPlan) => getBackend().executeSync(syncPlan));

ipcMain.handle('channels:list', async (_event, siteId) => getBackend().listChannels(siteId));

ipcMain.handle('channels:scanUpstream', async (_event, siteId, channelId) =>
  getBackend().scanChannelUpstreamModels(siteId, channelId),
);

ipcMain.handle('channels:sync', async (_event, siteId, channelId, models, options) =>
  getBackend().syncChannelModels(siteId, channelId, models, options),
);

ipcMain.handle('logs:get', async () => getBackend().getLogs());

app.whenReady().then(() => {
  getBackend();
  createWindow();
});
