import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSafeChannelModelMerge } from '../../.test-dist/electron/backend/channelSafety.js';

test('channel model sync only merges selected new models and never removes existing local models', () => {
  const result = buildSafeChannelModelMerge({
    currentModels: ['gpt-4o-mini', 'legacy-offline-model'],
    selectedModels: ['gpt-4o', 'gpt-4o-mini', '  '],
    resetAll: false,
  });

  assert.deepEqual(result.nextModels, [
    'gpt-4o-mini',
    'legacy-offline-model',
    'gpt-4o',
  ]);
  assert.deepEqual(result.addedModels, ['gpt-4o']);
  assert.deepEqual(result.removedModels, []);
});

test('channel model sync rejects resetAll because deletion operations are forbidden', () => {
  assert.throws(
    () =>
      buildSafeChannelModelMerge({
        currentModels: ['legacy-offline-model'],
        selectedModels: [],
        resetAll: true,
      }),
    /resetAll|删除|禁用/
  );
});
