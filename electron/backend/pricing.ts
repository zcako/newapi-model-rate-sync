import type { LocalPricingData, ModelPricing, SyncPlanItem } from './types';

const OPTION_KEYS = [
  'ModelRatio',
  'CompletionRatio',
  'CacheRatio',
  'CreateCacheRatio',
  'ModelPrice',
  'billing_setting.billing_mode',
  'billing_setting.billing_expr',
] as const;

type OptionKey = (typeof OPTION_KEYS)[number];
type OptionMap = Record<string, string>;
type JsonRecord<T> = Record<string, T>;

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(12));
}

function parseJsonRecord<T extends number | string>(raw: string | undefined): JsonRecord<T> {
  if (!raw || !String(raw).trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as JsonRecord<T>;
  } catch {
    return {};
  }
}

function stringifyRecord(record: JsonRecord<number | string>): string {
  const sorted: JsonRecord<number | string> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = record[key];
  }
  return JSON.stringify(sorted);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function toLocalPricing(model: ModelPricing | LocalPricingData): LocalPricingData {
  return {
    billing_mode: model.billing_mode,
    input_price: model.input_price || 0,
    output_price: model.output_price || 0,
    cache_read_price: model.cache_read_price || 0,
    cache_create_price: model.cache_create_price || 0,
    times_price: model.times_price || 0,
    expression: model.expression || '',
    tiers: Array.isArray(model.tiers) ? model.tiers : [],
  };
}

function buildTierExpression(tiers: LocalPricingData['tiers']): string {
  if (!tiers || tiers.length === 0) return '';
  const parts = tiers.map((tier, index) => {
    const label = `tier_${index + 1}`;
    const body = `p * ${round(tier.price || 0)}`;
    if (tier.range_end === -1) {
      return `tier("${label}", ${body})`;
    }
    return `len >= ${Number(tier.range_start || 0)} && len <= ${Number(tier.range_end || 0)} ? tier("${label}", ${body})`;
  });

  if (parts.length === 1) {
    return parts[0].replace(/^len .* \? /, '');
  }

  const fallback = parts[parts.length - 1].replace(/^len .* \? /, '');
  return `${parts.slice(0, -1).join(' : ')} : ${fallback}`;
}

export function optionsArrayToOptionMap(options: Array<{ key: string; value: unknown }>): OptionMap {
  const optionMap: OptionMap = {};
  for (const option of options || []) {
    optionMap[String(option.key)] = typeof option.value === 'string' ? option.value : String(option.value ?? '');
  }
  return optionMap;
}

export function modelPricingFromOptionMap(modelName: string, optionMap: OptionMap): ModelPricing {
  const modelRatio = parseJsonRecord<number>(optionMap.ModelRatio);
  const completionRatio = parseJsonRecord<number>(optionMap.CompletionRatio);
  const cacheRatio = parseJsonRecord<number>(optionMap.CacheRatio);
  const createCacheRatio = parseJsonRecord<number>(optionMap.CreateCacheRatio);
  const modelPrice = parseJsonRecord<number>(optionMap.ModelPrice);
  const billingMode = parseJsonRecord<string>(optionMap['billing_setting.billing_mode']);
  const billingExpr = parseJsonRecord<string>(optionMap['billing_setting.billing_expr']);

  const inputPrice = hasOwn(modelRatio, modelName) ? round(Number(modelRatio[modelName]) * 2) : 0;
  const expression = String(billingExpr[modelName] || '');

  let billing_mode: ModelPricing['billing_mode'] = 'unset';
  if (billingMode[modelName] === 'tiered_expr' && expression.trim()) {
    billing_mode = 'expr';
  } else if (hasOwn(modelPrice, modelName)) {
    billing_mode = 'times';
  } else if (
    hasOwn(modelRatio, modelName) ||
    hasOwn(completionRatio, modelName) ||
    hasOwn(cacheRatio, modelName) ||
    hasOwn(createCacheRatio, modelName)
  ) {
    billing_mode = 'quota';
  }

  return {
    id: modelName,
    name: modelName,
    billing_mode,
    input_price: inputPrice,
    output_price: inputPrice > 0 && hasOwn(completionRatio, modelName)
      ? round(inputPrice * Number(completionRatio[modelName]))
      : 0,
    cache_read_price: inputPrice > 0 && hasOwn(cacheRatio, modelName)
      ? round(inputPrice * Number(cacheRatio[modelName]))
      : 0,
    cache_create_price: inputPrice > 0 && hasOwn(createCacheRatio, modelName)
      ? round(inputPrice * Number(createCacheRatio[modelName]))
      : 0,
    times_price: hasOwn(modelPrice, modelName) ? round(Number(modelPrice[modelName])) : 0,
    expression,
    tiers: [],
    status: 'synced',
    lastUpdate: '',
  };
}

export function collectModelNamesFromOptionMap(optionMap: OptionMap): string[] {
  const names = new Set<string>();
  for (const key of OPTION_KEYS) {
    const record = parseJsonRecord<number | string>(optionMap[key]);
    for (const modelName of Object.keys(record)) {
      names.add(modelName);
    }
  }
  return [...names].sort();
}

export function getSummary(model: Partial<LocalPricingData> | ModelPricing): string {
  if (model.billing_mode === 'unset') return '未设置价格';
  if (model.billing_mode === 'quota') {
    const parts = [
      `输入 $${(model.input_price || 0).toFixed(4)}/1M`,
      `输出 $${(model.output_price || 0).toFixed(4)}/1M`,
    ];
    if ((model.cache_read_price || 0) > 0) {
      parts.push(`缓存读取 $${(model.cache_read_price || 0).toFixed(4)}/1M`);
    }
    if ((model.cache_create_price || 0) > 0) {
      parts.push(`缓存创建 $${(model.cache_create_price || 0).toFixed(4)}/1M`);
    }
    return parts.join(' / ');
  }
  if (model.billing_mode === 'times') {
    return `按次 $${(model.times_price || 0).toFixed(6)}/次`;
  }
  if (model.billing_mode === 'expr' || model.billing_mode === 'tiers') {
    const expression = model.expression || '';
    if (expression.trim()) {
      return `表达式 ${expression.slice(0, 40)}${expression.length > 40 ? '...' : ''}`;
    }
    const tiers = model.tiers || [];
    if (tiers.length > 0) {
      return `阶梯收费 ${tiers.length} 档`;
    }
    return '表达式未配置';
  }
  return '未知';
}

export function applyPricingToOptionMaps(
  sourceOptionMap: OptionMap,
  modelName: string,
  pricing: LocalPricingData,
): { optionMap: OptionMap; changedKeys: Set<OptionKey> } {
  const optionMap: OptionMap = { ...sourceOptionMap };
  const changedKeys = new Set<OptionKey>();
  const records: Record<OptionKey, JsonRecord<number | string>> = {
    ModelRatio: parseJsonRecord<number>(optionMap.ModelRatio),
    CompletionRatio: parseJsonRecord<number>(optionMap.CompletionRatio),
    CacheRatio: parseJsonRecord<number>(optionMap.CacheRatio),
    CreateCacheRatio: parseJsonRecord<number>(optionMap.CreateCacheRatio),
    ModelPrice: parseJsonRecord<number>(optionMap.ModelPrice),
    'billing_setting.billing_mode': parseJsonRecord<string>(optionMap['billing_setting.billing_mode']),
    'billing_setting.billing_expr': parseJsonRecord<string>(optionMap['billing_setting.billing_expr']),
  };

  const setNumber = (key: OptionKey, value: number) => {
    records[key][modelName] = round(value);
    changedKeys.add(key);
  };
  const setString = (key: OptionKey, value: string) => {
    records[key][modelName] = value;
    changedKeys.add(key);
  };
  const setStringIfPresent = (key: OptionKey, value: string) => {
    if (hasOwn(records[key], modelName)) {
      records[key][modelName] = value;
      changedKeys.add(key);
    }
  };
  const remove = (key: OptionKey) => {
    if (hasOwn(records[key], modelName)) {
      delete records[key][modelName];
      changedKeys.add(key);
    }
  };

  if (pricing.billing_mode === 'unset') {
    return { optionMap, changedKeys };
  }

  if (pricing.billing_mode === 'quota') {
    const input = Number(pricing.input_price || 0);
    const output = Number(pricing.output_price || 0);
    const cacheRead = Number(pricing.cache_read_price || 0);
    const cacheCreate = Number(pricing.cache_create_price || 0);

    if (input <= 0 && [output, cacheRead, cacheCreate].some((value) => value > 0)) {
      throw new Error(`模型 ${modelName} 的输入价格必须大于 0，才能换算输出/缓存倍率。`);
    }

    setNumber('ModelRatio', input / 2);
    setNumber('CompletionRatio', input > 0 ? output / input : 0);
    setNumber('CacheRatio', input > 0 ? cacheRead / input : 0);
    setNumber('CreateCacheRatio', input > 0 ? cacheCreate / input : 0);
    setStringIfPresent('billing_setting.billing_mode', 'ratio');
    remove('billing_setting.billing_expr');
    remove('ModelPrice');
  } else if (pricing.billing_mode === 'times') {
    setNumber('ModelPrice', Number(pricing.times_price || 0));
    setStringIfPresent('billing_setting.billing_mode', 'ratio');
    remove('ModelRatio');
    remove('CompletionRatio');
    remove('CacheRatio');
    remove('CreateCacheRatio');
    remove('billing_setting.billing_expr');
  } else if (pricing.billing_mode === 'expr' || pricing.billing_mode === 'tiers') {
    const expression = (pricing.expression || '').trim() || buildTierExpression(pricing.tiers || []);
    if (!expression) {
      throw new Error(`模型 ${modelName} 的表达式/阶梯收费缺少表达式。`);
    }
    setString('billing_setting.billing_mode', 'tiered_expr');
    setString('billing_setting.billing_expr', expression);
  }

  for (const key of OPTION_KEYS) {
    optionMap[key] = stringifyRecord(records[key]);
  }

  return { optionMap, changedKeys };
}

export function buildSyncPlan(input: {
  sourceSiteId: string;
  targetSiteIds: string[];
  modelNames: string[];
  sourceModels: ModelPricing[];
  targetModelsBySite: Record<string, ModelPricing[]>;
}): SyncPlanItem[] {
  const sourceByName = new Map(input.sourceModels.map((model) => [model.name, model]));
  const plans: SyncPlanItem[] = [];

  for (const targetSiteId of input.targetSiteIds) {
    const targetByName = new Map((input.targetModelsBySite[targetSiteId] || []).map((model) => [model.name, model]));

    for (const modelName of input.modelNames) {
      const sourceModel = sourceByName.get(modelName);
      if (!sourceModel) continue;

      const targetModel = targetByName.get(modelName);
      const sourceSummary = getSummary(sourceModel);
      const targetSummary = targetModel ? getSummary(targetModel) : '未设置价格';
      const targetHasPrice = Boolean(targetModel && targetModel.billing_mode !== 'unset');
      const sourceUnset = sourceModel.billing_mode === 'unset';

      let action: SyncPlanItem['action'] = 'UPDATE';
      let status = '待同步';

      if (sourceUnset && targetHasPrice) {
        action = 'BLOCKED';
        status = '被保护: 禁止将目标站已有价格设为未设置';
      } else if (sourceUnset) {
        action = 'SKIP';
        status = '源站未设置价格，跳过写入';
      } else if (targetSummary === sourceSummary) {
        action = 'NO_CHANGE';
        status = '无变化';
      } else if (!targetModel || targetModel.billing_mode === 'unset') {
        action = 'CREATE';
        status = '新增价格';
      }

      plans.push({
        source_site_id: input.sourceSiteId,
        target_site_id: targetSiteId,
        model_name: modelName,
        source_price_summary: sourceSummary,
        target_price_summary: targetSummary,
        action,
        status,
        pricing_payload: toLocalPricing(sourceModel),
      });
    }
  }

  return plans;
}
