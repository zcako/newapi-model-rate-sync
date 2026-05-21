export type BillingMode = 'unset' | 'quota' | 'times' | 'expr' | 'tiers';

export interface Site {
  id: string;
  name: string;
  url: string;
  status: 'connected' | 'failed' | 'connecting' | 'untested';
  auth_type?: 'admin' | 'user';
  auth_method?: 'access_token' | 'password';
  token?: string;
  user_id?: string;
  username?: string;
  password?: string;
  lastSync?: string;
}

export interface PricingTier {
  range_start: number;
  range_end: number;
  price: number;
}

export interface LocalPricingData {
  billing_mode: BillingMode;
  input_price: number;
  output_price: number;
  cache_read_price: number;
  cache_create_price: number;
  times_price: number;
  expression: string;
  tiers: PricingTier[];
}

export interface ModelPricing extends LocalPricingData {
  id: string;
  name: string;
  status: 'synced' | 'modified' | 'new' | 'error';
  lastUpdate: string;
}

export interface SyncPlanItem {
  source_site_id: string;
  target_site_id: string;
  model_name: string;
  source_price_summary: string;
  target_price_summary: string;
  action: 'CREATE' | 'UPDATE' | 'NO_CHANGE' | 'SKIP' | 'BLOCKED';
  status: string;
  error_message?: string;
  pricing_payload?: LocalPricingData;
}

export interface SyncResult {
  success: boolean;
  success_count: number;
  fail_count: number;
  logs: string[];
}

export interface Channel {
  id: string;
  name: string;
  type: string;
  base_url: string;
  models: string[];
  upstream_models: string[];
  raw?: Record<string, unknown>;
}

export interface ScannedModel {
  name: string;
  upstream_supported: boolean;
  local_enabled: boolean;
  status: 'new' | 'exists' | 'removed';
}

export interface AppData {
  sites: Site[];
  drafts: Record<string, Record<string, LocalPricingData>>;
  logs: string[];
}
