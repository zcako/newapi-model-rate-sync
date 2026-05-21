import { buildSafeChannelModelMerge } from './channelSafety';
import { NewApiClient } from './newapi';
import {
  applyPricingToOptionMaps,
  buildSyncPlan,
  collectModelNamesFromOptionMap,
  getSummary,
  modelPricingFromOptionMap,
  optionsArrayToOptionMap,
} from './pricing';
import { JsonStore } from './store';
import type { Channel, LocalPricingData, ModelPricing, ScannedModel, Site, SyncPlanItem, SyncResult } from './types';

type LogSink = (line: string) => void;

function nowText(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() || `site_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mergeUnique(base: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of [...base, ...extra]) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function toModelPricing(modelName: string, optionMap: Record<string, string>, draft?: LocalPricingData): ModelPricing {
  const base = modelPricingFromOptionMap(modelName, optionMap);
  if (!draft) return base;
  return {
    ...base,
    ...draft,
    id: base.id,
    name: base.name,
    status: 'modified',
    lastUpdate: nowText(),
  };
}

export class BackendService {
  constructor(
    private readonly store: JsonStore,
    private readonly logSink: LogSink = () => {},
    private readonly clientFactory: (site: Site) => NewApiClient = (site) => new NewApiClient(site),
  ) {}

  private log(message: string): string {
    const line = this.store.addLog(message);
    this.logSink(line);
    return line;
  }

  private requireSite(siteId: string): Site {
    const site = this.store.getSite(siteId);
    if (!site) throw new Error(`站点不存在: ${siteId}`);
    return site;
  }

  private client(siteId: string): NewApiClient {
    return this.clientFactory(this.requireSite(siteId));
  }

  listSites(): Site[] {
    return this.store.listSites();
  }

  addSite(siteData: Omit<Site, 'id' | 'status'>): Site {
    const site: Site = {
      ...siteData,
      id: createId(),
      status: 'untested',
    };
    this.store.saveSite(site);
    this.log(`[INFO] 添加站点: ${site.name}`);
    return site;
  }

  editSite(siteId: string, siteData: Partial<Site>): boolean {
    const updated = this.store.updateSite(siteId, siteData);
    if (updated) {
      this.log(`[INFO] 修改站点: ${updated.name}`);
      return true;
    }
    return false;
  }

  async testSite(siteId: string): Promise<{ success: boolean; status: 'connected' | 'failed'; message: string }> {
    const site = this.requireSite(siteId);
    this.store.updateSite(siteId, { status: 'connecting' });
    this.log(`[INFO] 正在测试站点连接: ${site.name}`);
    try {
      const self = await this.client(siteId).getSelf();
      const userId = String(self.id || site.user_id || '');
      this.store.updateSite(siteId, {
        status: 'connected',
        user_id: userId || site.user_id,
        lastSync: nowText(),
      });
      this.log(`[SUCCESS] 站点连接成功: ${site.name}`);
      return { success: true, status: 'connected', message: `连接成功，当前用户: ${self.username || userId || '未知'}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.store.updateSite(siteId, { status: 'failed' });
      this.log(`[ERROR] 站点连接失败: ${site.name} - ${message}`);
      return { success: false, status: 'failed', message };
    }
  }

  async loadSiteModels(siteId: string): Promise<ModelPricing[]> {
    const site = this.requireSite(siteId);
    const client = this.client(siteId);
    const optionMap = optionsArrayToOptionMap(await client.listOptions());
    const channels = await client.listChannels().catch(() => [] as Channel[]);
    const channelModels = channels.flatMap((channel) => channel.models || []);
    const drafts = this.store.listDrafts(siteId);
    const modelNames = mergeUnique(
      collectModelNamesFromOptionMap(optionMap),
      mergeUnique(channelModels, Object.keys(drafts)),
    ).sort();

    const models = modelNames.map((name) => toModelPricing(name, optionMap, drafts[name]));
    this.store.updateSite(siteId, { status: 'connected', lastSync: nowText() });
    this.log(`[INFO] 加载模型价格: ${site.name}, ${models.length} 个模型`);
    return models;
  }

  updateModelPricingLocal(siteId: string, modelName: string, pricingData: LocalPricingData): boolean {
    this.requireSite(siteId);
    this.store.saveDraft(siteId, modelName, pricingData);
    this.log(`[INFO] 本地修改价格: ${modelName} -> ${getSummary(pricingData)}`);
    return true;
  }

  async previewSync(sourceSiteId: string, targetSiteIds: string[], modelNames: string[], pricingPayload?: LocalPricingData): Promise<SyncPlanItem[]> {
    const sourceModels = await this.loadSiteModels(sourceSiteId);
    const effectiveSourceModels = pricingPayload
      ? sourceModels.map((model) => modelNames.includes(model.name) ? { ...model, ...pricingPayload, status: 'modified' as const } : model)
      : sourceModels;

    const targetModelsBySite: Record<string, ModelPricing[]> = {};
    for (const targetId of targetSiteIds) {
      targetModelsBySite[targetId] = await this.loadSiteModels(targetId);
    }

    const plans = buildSyncPlan({
      sourceSiteId,
      targetSiteIds,
      modelNames,
      sourceModels: effectiveSourceModels,
      targetModelsBySite,
    });

    const writeCount = plans.filter((plan) => plan.action === 'CREATE' || plan.action === 'UPDATE').length;
    this.log(`[INFO] 生成同步预览: ${plans.length} 项，需要写入 ${writeCount} 项`);
    return plans;
  }

  async executeSync(syncPlan: SyncPlanItem[]): Promise<SyncResult> {
    const logs: string[] = [];
    let successCount = 0;
    let failCount = 0;
    const executable = syncPlan.filter((item) => item.action === 'CREATE' || item.action === 'UPDATE');
    const bySite = new Map<string, SyncPlanItem[]>();

    for (const item of syncPlan) {
      if (item.action === 'BLOCKED') {
        failCount += 1;
        logs.push(`[WARN] 自动跳过被保护操作: ${item.model_name} -> ${item.target_site_id}`);
      }
      if (item.action === 'NO_CHANGE' || item.action === 'SKIP') {
        logs.push(`[INFO] 跳过: ${item.model_name} -> ${item.target_site_id} (${item.status})`);
      }
    }

    for (const item of executable) {
      bySite.set(item.target_site_id, [...(bySite.get(item.target_site_id) || []), item]);
    }

    for (const [targetSiteId, items] of bySite.entries()) {
      const client = this.client(targetSiteId);
      let optionMap = optionsArrayToOptionMap(await client.listOptions());
      const changedKeys = new Set<string>();

      for (const item of items) {
        try {
          if (!item.pricing_payload) {
            throw new Error('同步计划缺少价格载荷，请重新生成预览。');
          }
          const result = applyPricingToOptionMaps(optionMap, item.model_name, item.pricing_payload);
          optionMap = result.optionMap;
          result.changedKeys.forEach((key) => changedKeys.add(key));
          successCount += 1;
          logs.push(`[SUCCESS] 准备同步价格: ${item.model_name} -> ${targetSiteId} (${item.source_price_summary})`);
        } catch (error) {
          failCount += 1;
          logs.push(`[ERROR] 价格转换失败: ${item.model_name} -> ${targetSiteId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      for (const key of changedKeys) {
        await client.updateOption(key, optionMap[key] || '{}');
      }
    }

    for (const log of logs) this.log(log);
    this.log(`[SUCCESS] 同步完成: 成功 ${successCount} 项，失败/阻止 ${failCount} 项`);

    return {
      success: failCount === 0,
      success_count: successCount,
      fail_count: failCount,
      logs,
    };
  }

  async listChannels(siteId: string): Promise<Channel[]> {
    const channels = await this.client(siteId).listChannels();
    this.log(`[INFO] 加载渠道列表: ${this.requireSite(siteId).name}, ${channels.length} 个渠道`);
    return channels;
  }

  async scanChannelUpstreamModels(siteId: string, channelId: string): Promise<ScannedModel[]> {
    const channels = await this.client(siteId).listChannels();
    const channel = channels.find((item) => item.id === String(channelId));
    if (!channel) throw new Error(`找不到渠道: ${channelId}`);

    this.log(`[INFO] 正在扫描渠道 [${channel.name}] 的上游模型列表...`);
    const upstreamModels = await this.client(siteId).fetchUpstreamModels(channelId);
    const names = mergeUnique(channel.models, upstreamModels).sort();
    const upstreamSet = new Set(upstreamModels);
    const localSet = new Set(channel.models);
    const result = names.map((name) => {
      const upstream_supported = upstreamSet.has(name);
      const local_enabled = localSet.has(name);
      const status: ScannedModel['status'] = upstream_supported && !local_enabled
        ? 'new'
        : !upstream_supported && local_enabled
        ? 'removed'
        : 'exists';
      return { name, upstream_supported, local_enabled, status };
    });
    this.log(`[SUCCESS] 渠道 [${channel.name}] 扫描完成，发现 ${result.filter((item) => item.status === 'new').length} 个新模型。`);
    return result;
  }

  async syncChannelModels(
    siteId: string,
    channelId: string,
    models: string[],
    options: { autoAddPricing: boolean; resetAll: boolean; sourceSiteId?: string },
  ): Promise<{ success: boolean; logs: string[] }> {
    const logs: string[] = [];
    const client = this.client(siteId);
    const channel = await client.getChannel(channelId);
    const merge = buildSafeChannelModelMerge({
      currentModels: channel.models,
      selectedModels: models,
      resetAll: options.resetAll,
    });

    if (merge.addedModels.length === 0) {
      logs.push(`[INFO] 渠道 [${channel.name}] 没有需要新增开启的模型。`);
      logs.forEach((line) => this.log(line));
      return { success: true, logs };
    }

    await client.updateChannelModels(channel, merge.nextModels);
    logs.push(`[SUCCESS] 渠道 [${channel.name}] 成功新增开启模型: ${merge.addedModels.join(', ')}`);

    if (options.autoAddPricing) {
      await this.initializePricingForAddedModels(siteId, options.sourceSiteId, merge.addedModels, logs);
    }

    logs.push(`[SUCCESS] 渠道 [${channel.name}] 模型同步完成，安全模式未删除任何已有模型。`);
    logs.forEach((line) => this.log(line));
    return { success: true, logs };
  }

  private async initializePricingForAddedModels(targetSiteId: string, sourceSiteId: string | undefined, modelNames: string[], logs: string[]): Promise<void> {
    const targetClient = this.client(targetSiteId);
    let targetOptionMap = optionsArrayToOptionMap(await targetClient.listOptions());
    const targetModels = await this.loadSiteModels(targetSiteId);
    const targetByName = new Map(targetModels.map((model) => [model.name, model]));
    const changedKeys = new Set<string>();
    let initialized = 0;
    let unset = 0;

    const sourceModels = sourceSiteId ? await this.loadSiteModels(sourceSiteId) : [];
    const sourceByName = new Map(sourceModels.map((model) => [model.name, model]));

    for (const modelName of modelNames) {
      const target = targetByName.get(modelName);
      if (target && target.billing_mode !== 'unset') continue;

      const source = sourceByName.get(modelName);
      if (!source || source.billing_mode === 'unset') {
        unset += 1;
        continue;
      }

      const result = applyPricingToOptionMaps(targetOptionMap, modelName, source);
      targetOptionMap = result.optionMap;
      result.changedKeys.forEach((key) => changedKeys.add(key));
      initialized += 1;
    }

    for (const key of changedKeys) {
      await targetClient.updateOption(key, targetOptionMap[key] || '{}');
    }

    if (initialized > 0) {
      logs.push(`[SUCCESS] 已为 ${initialized} 个新增模型复制源站价格。`);
    }
    if (unset > 0) {
      logs.push(`[INFO] ${unset} 个新增模型源站无价格，保持未设置状态，请到价格工作台手动定价。`);
    }
  }

  getLogs(): string[] {
    return this.store.getLogs();
  }
}
