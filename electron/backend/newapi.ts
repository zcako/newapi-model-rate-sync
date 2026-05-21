import type { Channel, Site } from './types';

type FetchLike = typeof fetch;

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
}

const channelTypeNames: Record<number, string> = {
  1: 'OpenAI',
  3: 'Azure',
  4: 'Ollama',
  8: 'Custom',
  14: 'Anthropic',
  20: 'OpenRouter',
  24: 'Gemini',
  33: 'AWS',
  40: 'SiliconFlow',
  41: 'VertexAI',
  42: 'Mistral',
  43: 'DeepSeek',
  45: 'VolcEngine',
  57: 'Codex',
};

function normalizeBaseUrl(url: string): string {
  const trimmed = String(url || '').trim();
  return trimmed.replace(/\/+$/, '');
}

function parseModels(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeChannel(raw: Record<string, unknown>): Channel {
  const numericType = Number(raw.type);
  const type = Number.isFinite(numericType)
    ? channelTypeNames[numericType] || String(numericType)
    : String(raw.type || 'Unknown');

  return {
    id: String(raw.id),
    name: String(raw.name || `渠道 ${raw.id}`),
    type,
    base_url: String(raw.base_url || ''),
    models: parseModels(raw.models),
    upstream_models: [],
    raw,
  };
}

export class NewApiClient {
  private cookie = '';
  private passwordUserId = '';

  constructor(
    private readonly site: Site,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private buildUrl(path: string): string {
    return `${normalizeBaseUrl(this.site.url)}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async ensurePasswordSession(): Promise<void> {
    if (this.site.auth_method !== 'password' || this.cookie) return;
    if (!this.site.username || !this.site.password) {
      throw new Error('站点缺少用户名或密码。');
    }

    const response = await this.fetchImpl(this.buildUrl('/api/user/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.site.username,
        password: this.site.password,
      }),
    });
    const json = await response.json() as ApiResponse<{ id?: number; require_2fa?: boolean }>;
    if (!response.ok || json.success === false) {
      throw new Error(json.message || `登录失败: HTTP ${response.status}`);
    }
    if (json.data?.require_2fa) {
      throw new Error('该站点启用了 2FA，当前工具暂不支持密码方式完成二次验证，请使用 Access Token。');
    }

    this.passwordUserId = String(json.data?.id || this.site.user_id || '');
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      this.cookie = setCookie.split(',').map((part) => part.split(';')[0]).join('; ');
    }
  }

  private async headers(): Promise<Record<string, string>> {
    await this.ensurePasswordSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'New-Api-User': String(this.site.user_id || this.passwordUserId || '1'),
    };

    if (this.site.auth_method === 'password') {
      if (this.cookie) headers.Cookie = this.cookie;
    } else if (this.site.token) {
      headers.Authorization = this.site.token;
    } else {
      throw new Error('站点缺少 Access Token。');
    }

    return headers;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(this.buildUrl(path), {
      ...init,
      headers: {
        ...(await this.headers()),
        ...(init.headers || {}),
      },
    });

    let json: ApiResponse<T>;
    try {
      json = await response.json() as ApiResponse<T>;
    } catch {
      throw new Error(`响应不是合法 JSON: HTTP ${response.status}`);
    }

    if (!response.ok || json.success === false) {
      throw new Error(json.message || `请求失败: HTTP ${response.status}`);
    }

    return json.data as T;
  }

  async getSelf(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/user/self', { method: 'GET' });
  }

  async listOptions(): Promise<Array<{ key: string; value: unknown }>> {
    return this.request<Array<{ key: string; value: unknown }>>('/api/option/', { method: 'GET' });
  }

  async updateOption(key: string, value: string): Promise<void> {
    await this.request('/api/option/', {
      method: 'PUT',
      body: JSON.stringify({ key, value }),
    });
  }

  async listChannels(): Promise<Channel[]> {
    const data = await this.request<any>('/api/channel/?p=1&page_size=1000', { method: 'GET' });
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return items.map((item: Record<string, unknown>) => normalizeChannel(item));
  }

  async getChannel(channelId: string): Promise<Channel> {
    const raw = await this.request<Record<string, unknown>>(`/api/channel/${encodeURIComponent(channelId)}`, { method: 'GET' });
    return normalizeChannel(raw);
  }

  async fetchUpstreamModels(channelId: string): Promise<string[]> {
    const data = await this.request<unknown>(`/api/channel/fetch_models/${encodeURIComponent(channelId)}`, { method: 'GET' });
    return parseModels(data);
  }

  async updateChannelModels(channel: Channel, nextModels: string[]): Promise<void> {
    const raw = { ...(channel.raw || {}) };
    raw.id = Number(channel.id);
    raw.models = nextModels.join(',');
    await this.request('/api/channel/', {
      method: 'PUT',
      body: JSON.stringify(raw),
    });
  }
}
