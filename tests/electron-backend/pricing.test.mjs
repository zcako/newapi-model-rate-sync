import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPricingToOptionMaps,
  buildSyncPlan,
  modelPricingFromOptionMap,
  optionsArrayToOptionMap,
} from '../../.test-dist/electron/backend/pricing.js';

test('maps NewAPI ratio options to direct per-1M token prices', () => {
  const optionMap = optionsArrayToOptionMap([
    { key: 'ModelRatio', value: JSON.stringify({ 'gpt-4o-mini': 0.075 }) },
    { key: 'CompletionRatio', value: JSON.stringify({ 'gpt-4o-mini': 4 }) },
    { key: 'CacheRatio', value: JSON.stringify({ 'gpt-4o-mini': 0.5 }) },
    { key: 'CreateCacheRatio', value: JSON.stringify({ 'gpt-4o-mini': 1 }) },
    { key: 'ModelPrice', value: JSON.stringify({ 'dall-e-3': 0.08 }) },
  ]);

  const tokenModel = modelPricingFromOptionMap('gpt-4o-mini', optionMap);
  assert.equal(tokenModel.billing_mode, 'quota');
  assert.equal(tokenModel.input_price, 0.15);
  assert.equal(tokenModel.output_price, 0.6);
  assert.equal(tokenModel.cache_read_price, 0.075);
  assert.equal(tokenModel.cache_create_price, 0.15);

  const timesModel = modelPricingFromOptionMap('dall-e-3', optionMap);
  assert.equal(timesModel.billing_mode, 'times');
  assert.equal(timesModel.times_price, 0.08);
});

test('serializes direct prices back to NewAPI ratio option maps', () => {
  const result = applyPricingToOptionMaps(
    {
      ModelRatio: '{}',
      CompletionRatio: '{}',
      CacheRatio: '{}',
      CreateCacheRatio: '{}',
      ModelPrice: '{"legacy":0.2}',
    },
    'gpt-4o-mini',
    {
      billing_mode: 'quota',
      input_price: 0.15,
      output_price: 0.6,
      cache_read_price: 0.075,
      cache_create_price: 0.15,
      times_price: 0,
      expression: '',
      tiers: [],
    }
  );

  assert.deepEqual(JSON.parse(result.optionMap.ModelRatio), { 'gpt-4o-mini': 0.075 });
  assert.deepEqual(JSON.parse(result.optionMap.CompletionRatio), { 'gpt-4o-mini': 4 });
  assert.deepEqual(JSON.parse(result.optionMap.CacheRatio), { 'gpt-4o-mini': 0.5 });
  assert.deepEqual(JSON.parse(result.optionMap.CreateCacheRatio), { 'gpt-4o-mini': 1 });
  assert.deepEqual(JSON.parse(result.optionMap.ModelPrice), { legacy: 0.2 });
  assert.deepEqual([...result.changedKeys].sort(), [
    'CacheRatio',
    'CompletionRatio',
    'CreateCacheRatio',
    'ModelRatio',
  ]);
});

test('mode switch to per-request removes conflicting ratio keys but keeps unrelated models', () => {
  const result = applyPricingToOptionMaps(
    {
      ModelRatio: '{"gpt-4o-mini":0.075,"other":1}',
      CompletionRatio: '{"gpt-4o-mini":4,"other":2}',
      CacheRatio: '{"gpt-4o-mini":0.5}',
      CreateCacheRatio: '{"gpt-4o-mini":1}',
      ModelPrice: '{"legacy":0.2}',
    },
    'gpt-4o-mini',
    {
      billing_mode: 'times',
      input_price: 0,
      output_price: 0,
      cache_read_price: 0,
      cache_create_price: 0,
      times_price: 0.02,
      expression: '',
      tiers: [],
    }
  );

  assert.deepEqual(JSON.parse(result.optionMap.ModelPrice), {
    legacy: 0.2,
    'gpt-4o-mini': 0.02,
  });
  assert.deepEqual(JSON.parse(result.optionMap.ModelRatio), { other: 1 });
  assert.deepEqual(JSON.parse(result.optionMap.CompletionRatio), { other: 2 });
  assert.deepEqual(JSON.parse(result.optionMap.CacheRatio), {});
  assert.deepEqual(JSON.parse(result.optionMap.CreateCacheRatio), {});
});

test('sync preview blocks clearing an existing target price with unset source', () => {
  const plans = buildSyncPlan({
    sourceSiteId: 'source',
    targetSiteIds: ['target'],
    modelNames: ['gpt-4o-mini'],
    sourceModels: [
      {
        id: 'gpt-4o-mini',
        name: 'gpt-4o-mini',
        billing_mode: 'unset',
        input_price: 0,
        output_price: 0,
        cache_read_price: 0,
        cache_create_price: 0,
        times_price: 0,
        expression: '',
        tiers: [],
        status: 'synced',
        lastUpdate: '',
      },
    ],
    targetModelsBySite: {
      target: [
        {
          id: 'gpt-4o-mini',
          name: 'gpt-4o-mini',
          billing_mode: 'quota',
          input_price: 0.15,
          output_price: 0.6,
          cache_read_price: 0,
          cache_create_price: 0,
          times_price: 0,
          expression: '',
          tiers: [],
          status: 'synced',
          lastUpdate: '',
        },
      ],
    },
  });

  assert.equal(plans.length, 1);
  assert.equal(plans[0].action, 'BLOCKED');
  assert.match(plans[0].status, /禁止|保护/);
});
