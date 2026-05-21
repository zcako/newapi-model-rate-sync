export function normalizeModelNames(models: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of models) {
    const name = String(item || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    normalized.push(name);
  }

  return normalized;
}

export function buildSafeChannelModelMerge(input: {
  currentModels: string[];
  selectedModels: string[];
  resetAll?: boolean;
}): {
  nextModels: string[];
  addedModels: string[];
  removedModels: string[];
} {
  if (input.resetAll) {
    throw new Error('resetAll 被禁用：本工具禁止删除或清空渠道模型。');
  }

  const currentModels = normalizeModelNames(input.currentModels);
  const selectedModels = normalizeModelNames(input.selectedModels);
  const currentSet = new Set(currentModels);
  const addedModels = selectedModels.filter((name) => !currentSet.has(name));

  return {
    nextModels: [...currentModels, ...addedModels],
    addedModels,
    removedModels: [],
  };
}
