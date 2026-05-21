import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  
  // Sites IPC
  listSites: () => ipcRenderer.invoke('sites:list'),
  addSite: (siteData: any) => ipcRenderer.invoke('sites:add', siteData),
  editSite: (siteId: string, siteData: any) => ipcRenderer.invoke('sites:edit', siteId, siteData),
  testSite: (siteId: string) => ipcRenderer.invoke('sites:test', siteId),
  
  // Models IPC
  loadSiteModels: (siteId: string) => ipcRenderer.invoke('models:load', siteId),
  updateModelPricingLocal: (siteId: string, modelName: string, pricingData: any) => 
    ipcRenderer.invoke('pricing:updateLocal', siteId, modelName, pricingData),
  
  // Sync IPC
  previewSync: (sourceSiteId: string, targetSiteIds: string[], modelNames: string[], pricingPayload?: any) => 
    ipcRenderer.invoke('pricing:previewSync', sourceSiteId, targetSiteIds, modelNames, pricingPayload),
  executeSync: (syncPlan: any[]) => ipcRenderer.invoke('pricing:executeSync', syncPlan),
  
  // Channels IPC
  listChannels: (siteId: string) => ipcRenderer.invoke('channels:list', siteId),
  scanChannelUpstreamModels: (siteId: string, channelId: string) => 
    ipcRenderer.invoke('channels:scanUpstream', siteId, channelId),
  syncChannelModels: (siteId: string, channelId: string, models: string[], options: any) => 
    ipcRenderer.invoke('channels:sync', siteId, channelId, models, options),

  // Logs IPC
  getSyncLogs: () => ipcRenderer.invoke('logs:get'),
  onLogMessage: (callback: (message: string) => void) => {
    const subscription = (_event: any, value: string) => callback(value)
    ipcRenderer.on('log-message', subscription)
    return () => {
      ipcRenderer.removeListener('log-message', subscription)
    }
  }
})
