/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    ping: () => Promise<string>;
    
    // Sites IPC
    listSites: () => Promise<any[]>;
    addSite: (siteData: any) => Promise<any>;
    editSite: (siteId: string, siteData: any) => Promise<boolean>;
    testSite: (siteId: string) => Promise<{ success: boolean; status: string; message: string }>;
    
    // Models IPC
    loadSiteModels: (siteId: string) => Promise<any[]>;
    updateModelPricingLocal: (siteId: string, modelName: string, pricingData: any) => Promise<boolean>;
    
    // Sync IPC
    previewSync: (sourceSiteId: string, targetSiteIds: string[], modelNames: string[], pricingPayload?: any) => Promise<any[]>;
    executeSync: (syncPlan: any[]) => Promise<{ success: boolean; success_count: number; fail_count: number; logs: string[] }>;
    
    // Channels IPC
    listChannels: (siteId: string) => Promise<any[]>;
    scanChannelUpstreamModels: (siteId: string, channelId: string) => Promise<any[]>;
    syncChannelModels: (siteId: string, channelId: string, models: string[], options: { autoAddPricing: boolean; resetAll: boolean; sourceSiteId?: string }) => Promise<{ success: boolean; logs: string[] }>;

    // Logs IPC
    getSyncLogs: () => Promise<string[]>;
    onLogMessage: (callback: (message: string) => void) => () => void;
  }
}
