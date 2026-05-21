import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AppData, LocalPricingData, Site } from './types';

const emptyData = (): AppData => ({
  sites: [],
  drafts: {},
  logs: [],
});

export class JsonStore {
  private data: AppData | null = null;

  constructor(private readonly filePath: string) {}

  getData(): AppData {
    if (this.data) return this.data;
    if (!existsSync(this.filePath)) {
      this.data = emptyData();
      return this.data;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<AppData>;
      this.data = {
        sites: Array.isArray(parsed.sites) ? parsed.sites : [],
        drafts: parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {},
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      };
    } catch {
      this.data = emptyData();
    }
    return this.data;
  }

  save(): void {
    const data = this.getData();
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  listSites(): Site[] {
    return [...this.getData().sites];
  }

  saveSite(site: Site): Site {
    const data = this.getData();
    const index = data.sites.findIndex((item) => item.id === site.id);
    if (index >= 0) {
      data.sites[index] = site;
    } else {
      data.sites.push(site);
    }
    this.save();
    return site;
  }

  getSite(siteId: string): Site | undefined {
    return this.getData().sites.find((site) => site.id === siteId);
  }

  updateSite(siteId: string, patch: Partial<Site>): Site | undefined {
    const current = this.getSite(siteId);
    if (!current) return undefined;
    const updated = { ...current, ...patch, id: current.id };
    this.saveSite(updated);
    return updated;
  }

  getDraft(siteId: string, modelName: string): LocalPricingData | undefined {
    return this.getData().drafts[siteId]?.[modelName];
  }

  saveDraft(siteId: string, modelName: string, draft: LocalPricingData): void {
    const data = this.getData();
    data.drafts[siteId] = data.drafts[siteId] || {};
    data.drafts[siteId][modelName] = draft;
    this.save();
  }

  listDrafts(siteId: string): Record<string, LocalPricingData> {
    return { ...(this.getData().drafts[siteId] || {}) };
  }

  addLog(message: string): string {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const line = `[${timestamp}] ${message}`;
    const data = this.getData();
    data.logs.push(line);
    if (data.logs.length > 2000) {
      data.logs = data.logs.slice(-2000);
    }
    this.save();
    return line;
  }

  getLogs(): string[] {
    return [...this.getData().logs];
  }
}
