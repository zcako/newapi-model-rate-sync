export interface Site {
  id: string;
  name: string;
  url: string;
  status: 'connected' | 'failed' | 'connecting' | 'untested';
  type?: 'admin' | 'user';
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

export interface ModelPricing {
  id: string;
  name: string;
  billing_mode: 'unset' | 'quota' | 'times' | 'expr' | 'tiers';
  input_price: number;
  output_price: number;
  cache_read_price: number;
  cache_create_price: number;
  times_price: number;
  expression: string;
  tiers?: PricingTier[];
  status: 'synced' | 'modified' | 'new' | 'error';
  lastUpdate: string;
}

export interface Tier {
  range_start: number;
  range_end: number;
  price: number;
}

export interface LocalPricingData {
  billing_mode: 'unset' | 'quota' | 'times' | 'expr';
  input_price: number;
  output_price: number;
  cache_read_price: number;
  cache_create_price: number;
  times_price: number;
  expression: string;
  tiers: Tier[];
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
}

export interface SyncResult {
  success: boolean;
  success_count: number;
  fail_count: number;
  logs: string[];
}
