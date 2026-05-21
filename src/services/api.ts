import { Site, ModelPricing, Tier, LocalPricingData, SyncPlanItem, SyncResult } from './types';

export type { Site, ModelPricing, Tier, LocalPricingData, SyncPlanItem, SyncResult };

// Helper to get electronAPI safely
const getElectronAPI = () => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI;
  }
  // Fallback stub for server-side execution/build time
  return {
    listSites: () => Promise.reject(new Error('Electron API not available')),
    addSite: () => Promise.reject(new Error('Electron API not available')),
    editSite: () => Promise.reject(new Error('Electron API not available')),
    testSite: () => Promise.reject(new Error('Electron API not available')),
    loadSiteModels: () => Promise.reject(new Error('Electron API not available')),
    updateModelPricingLocal: () => Promise.reject(new Error('Electron API not available')),
    previewSync: () => Promise.reject(new Error('Electron API not available')),
    executeSync: () => Promise.reject(new Error('Electron API not available')),
    getSyncLogs: () => Promise.resolve([] as string[]),
    onLogMessage: () => () => {},
    listChannels: () => Promise.reject(new Error('Electron API not available')),
    scanChannelUpstreamModels: () => Promise.reject(new Error('Electron API not available')),
    syncChannelModels: () => Promise.reject(new Error('Electron API not available')),
  };
};

export const apiService = {
  // 1. Get sites
  listSites: async (): Promise<Site[]> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.listSites();
  },

  // 2. Add site
  addSite: async (siteData: Omit<Site, 'id' | 'status'>): Promise<Site> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.addSite(siteData);
  },

  // 3. Edit site
  editSite: async (siteId: string, siteData: Partial<Site>): Promise<boolean> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.editSite(siteId, siteData);
  },

  // 4. Test connection
  testSite: async (siteId: string): Promise<{ success: boolean; status: string; message: string }> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.testSite(siteId);
  },

  // 5. Load site models
  loadSiteModels: async (siteId: string): Promise<ModelPricing[]> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.loadSiteModels(siteId);
  },

  // 6. Update local pricing
  updateModelPricingLocal: async (
    siteId: string,
    modelName: string,
    pricingData: LocalPricingData
  ): Promise<boolean> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.updateModelPricingLocal(siteId, modelName, pricingData);
  },

  // 7. Preview Sync
  previewSync: async (
    sourceSiteId: string,
    targetSiteIds: string[],
    modelNames: string[],
    pricingPayload?: LocalPricingData
  ): Promise<SyncPlanItem[]> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.previewSync(sourceSiteId, targetSiteIds, modelNames, pricingPayload);
  },

  // 8. Execute Sync
  executeSync: async (syncPlan: SyncPlanItem[]): Promise<SyncResult> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.executeSync(syncPlan);
  },

  // 9. Get all logs
  getSyncLogs: async (): Promise<string[]> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.getSyncLogs();
  },

  // 10. Subscribe logs
  subscribeLogs: (callback: (message: string) => void) => {
    const api = window.electronAPI || getElectronAPI();
    return api.onLogMessage(callback);
  },

  // 11. List channels of a site
  listChannels: async (siteId: string): Promise<any[]> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.listChannels(siteId);
  },

  // 12. Scan channel's upstream models
  scanChannelUpstreamModels: async (siteId: string, channelId: string): Promise<any[]> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.scanChannelUpstreamModels(siteId, channelId);
  },

  // 13. Sync channel models with upstream
  syncChannelModels: async (
    siteId: string,
    channelId: string,
    models: string[],
    options: { autoAddPricing: boolean; resetAll: boolean; sourceSiteId?: string }
  ): Promise<{ success: boolean; logs: string[] }> => {
    const api = window.electronAPI || getElectronAPI();
    return await api.syncChannelModels(siteId, channelId, models, options);
  },
};

export const addLocalLog = (message: string) => {
  console.log(`[Frontend Log] ${message}`);
};

export function getSummary(m: Partial<LocalPricingData> | ModelPricing): string {
  const model = m as any;
  if (model.billing_mode === 'unset') return '未设置价格';
  if (model.billing_mode === 'quota') {
    const parts = [
      `输入 $${(model.input_price || 0).toFixed(4)}/1M`,
      `输出 $${(model.output_price || 0).toFixed(4)}/1M`,
    ];
    if (model.cache_read_price && model.cache_read_price > 0) {
      parts.push(`缓存读取 $${model.cache_read_price.toFixed(4)}/1M`);
    }
    if (model.cache_create_price && model.cache_create_price > 0) {
      parts.push(`缓存创建 $${model.cache_create_price.toFixed(4)}/1M`);
    }
    return parts.join(' / ');
  }
  if (model.billing_mode === 'times') {
    return `按次 $${(model.times_price || 0).toFixed(6)}/次`;
  }
  if (model.billing_mode === 'expr') {
    if (model.expression) {
      return `表达式 ${model.expression.substring(0, 40)}${model.expression.length > 40 ? '...' : ''}`;
    }
    if (model.tiers && model.tiers.length > 0) {
      return `阶梯收费 ${model.tiers.length} 档`;
    }
    return '表达式未配置';
  }
  return '未知';
}
