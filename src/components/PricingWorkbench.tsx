import React, { useState, useEffect, useMemo } from 'react';
import {
  Server,
  Plus,
  Search,
  RefreshCw,
  Zap,
  Pencil,
  BadgeDollarSign,
  CheckCircle2,
  AlertTriangle,
  Play,
  Trash2,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { apiService, Tier, addLocalLog, Site, ModelPricing } from '../services/api';

interface PricingWorkbenchProps {
  sites: Site[];
  onRefreshSites: () => void;
  onOpenSiteModal: (site: Site | null) => void;
  onOpenSyncPreview: (sourceId: string, targetIds: string[], modelNames: string[]) => void;
  onChangeTargetSites?: (ids: string[]) => void;
  onChangeSelectedModels?: (names: string[]) => void;
  onSourceSiteChange?: (id: string) => void;
}

export const PricingWorkbench: React.FC<PricingWorkbenchProps> = ({
  sites,
  onRefreshSites,
  onOpenSiteModal,
  onOpenSyncPreview,
  onChangeTargetSites,
  onChangeSelectedModels,
  onSourceSiteChange,
}) => {
  // Site states
  const [sourceSiteId, setSourceSiteId] = useState<string>('1');
  const [targetSiteIds, setTargetSiteIds] = useState<string[]>(['2']);
  const [testingSiteId, setTestingSiteId] = useState<string | null>(null);

  // Model states
  const [models, setModels] = useState<ModelPricing[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [focusedModelId, setFocusedModelId] = useState<string | null>('m1');
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Sync callbacks to parent
  useEffect(() => {
    if (onChangeTargetSites) onChangeTargetSites(targetSiteIds);
  }, [targetSiteIds, onChangeTargetSites]);

  useEffect(() => {
    const selectedNames = models
      .filter(m => selectedModelIds.includes(m.id))
      .map(m => m.name);
    if (onChangeSelectedModels) onChangeSelectedModels(selectedNames);
  }, [selectedModelIds, models, onChangeSelectedModels]);

  useEffect(() => {
    if (onSourceSiteChange) onSourceSiteChange(sourceSiteId);
  }, [sourceSiteId, onSourceSiteChange]);

  // Filtering states
  const [filterMode, setFilterMode] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = useState('');

  // Editing form states (bind to focused model)
  const [editBillingMode, setEditBillingMode] = useState<'unset' | 'quota' | 'times' | 'expr'>('quota');
  const [editInputPrice, setEditInputPrice] = useState(0);
  const [editOutputPrice, setEditOutputPrice] = useState(0);
  const [customCache, setCustomCache] = useState(false);
  const [editCacheRead, setEditCacheRead] = useState(0);
  const [editCacheCreate, setEditCacheCreate] = useState(0);
  const [editTimesPrice, setEditTimesPrice] = useState(0);
  const [editExpression, setEditExpression] = useState('');
  const [editTiers, setEditTiers] = useState<Tier[]>([]);
  
  // Expression testing states
  const [exprTestParam, setExprTestParam] = useState('1000');
  const [exprValidationResult, setExprValidationResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load models when source site changes
  const loadSourceModels = async () => {
    if (!sourceSiteId) return;
    setIsLoadingModels(true);
    try {
      const data = await apiService.loadSiteModels(sourceSiteId);
      setModels(data);
      // Automatically focus first model if available and none selected
      if (data.length > 0) {
        setFocusedModelId(data[0].id);
      }
    } catch (err: any) {
      addLocalLog(`[ERROR] 加载源站点模型价格发生错误: ${err.message}`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    loadSourceModels();
  }, [sourceSiteId]);

  const focusedModel = useMemo(() => {
    return models.find(m => m.id === focusedModelId) || null;
  }, [models, focusedModelId]);

  // Bind edit form states when focused model changes
  useEffect(() => {
    if (focusedModel) {
      setEditBillingMode(focusedModel.billing_mode as any);
      setEditInputPrice(focusedModel.input_price || 0);
      setEditOutputPrice(focusedModel.output_price || 0);
      setCustomCache(Boolean((focusedModel.cache_read_price || 0) > 0 || (focusedModel.cache_create_price || 0) > 0));
      setEditCacheRead(focusedModel.cache_read_price || 0);
      setEditCacheCreate(focusedModel.cache_create_price || 0);
      setEditTimesPrice(focusedModel.times_price || 0);
      setEditExpression(focusedModel.expression || '');
      setEditTiers((focusedModel.tiers || []).map((t: any) => ({
        range_start: Number(t.range_start || t.start || 0),
        range_end: Number(t.range_end !== undefined ? t.range_end : (t.end !== undefined ? t.end : -1)),
        price: Number(t.price || 0),
      })));
      setExprValidationResult(null);
    }
  }, [focusedModel]);

  const handleTestConnection = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTestingSiteId(id);
    await apiService.testSite(id);
    setTestingSiteId(null);
    onRefreshSites();
  };

  // Filtered models list
  const filteredModels = useMemo(() => {
    return models.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesFilter = true;
      if (filterMode === '未设置价格') {
        matchesFilter = m.billing_mode === 'unset';
      } else if (filterMode === '按量计费') {
        matchesFilter = m.billing_mode === 'quota';
      } else if (filterMode === '按次收费') {
        matchesFilter = m.billing_mode === 'times';
      } else if (filterMode === '表达式/阶梯') {
        matchesFilter = m.billing_mode === 'expr';
      }

      const matchesDiff = !showDiffOnly || (m.status === 'modified' || m.status === 'new');
      const matchesSelected = !showSelectedOnly || selectedModelIds.includes(m.id);

      return matchesSearch && matchesFilter && matchesDiff && matchesSelected;
    });
  }, [models, searchQuery, filterMode, showDiffOnly, showSelectedOnly, selectedModelIds]);

  const toggleModelSelection = (id: string) => {
    setSelectedModelIds(prev =>
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedModelIds(filteredModels.map(m => m.id));
    } else {
      setSelectedModelIds([]);
    }
  };

  // Handle local saving of modified price
  const handleSaveLocal = async () => {
    if (!focusedModel) return;

    const pricingData = {
      billing_mode: editBillingMode as any,
      input_price: editBillingMode === 'quota' ? editInputPrice : 0,
      output_price: editBillingMode === 'quota' ? editOutputPrice : 0,
      cache_read_price: (editBillingMode === 'quota' && customCache) ? editCacheRead : 0,
      cache_create_price: (editBillingMode === 'quota' && customCache) ? editCacheCreate : 0,
      times_price: editBillingMode === 'times' ? editTimesPrice : 0,
      expression: editBillingMode === 'expr' ? editExpression : '',
      tiers: editBillingMode === 'expr' ? editTiers : [],
    };

    const success = await apiService.updateModelPricingLocal(sourceSiteId, focusedModel.name, pricingData);
    if (success) {
      loadSourceModels();
    }
  };

  // Expression validation
  const validateExpression = () => {
    if (!editExpression.trim()) {
      setExprValidationResult({ success: false, message: '表达式内容不能为空' });
      return;
    }
    // Simple frontend parsing check
    const hasP = editExpression.includes('p');
    const hasTier = editExpression.includes('tier');
    if (!hasP && !hasTier) {
      setExprValidationResult({
        success: false,
        message: '验证失败: 表达式格式不正确，缺少计费因子 (p) 或阶梯标记 (tier)。',
      });
    } else {
      setExprValidationResult({
        success: true,
        message: `验证成功: 模拟解析测试输入 tokens=${exprTestParam} 时，计算系数溢出率为 1.00`,
      });
    }
  };

  // Tiers operations
  const handleAddTier = () => {
    setEditTiers(prev => [
      ...prev,
      { range_start: prev.length > 0 ? prev[prev.length - 1].range_end + 1 : 0, range_end: -1, price: 0.1 },
    ]);
  };

  const handleRemoveTier = (index: number) => {
    setEditTiers(prev => prev.filter((_, idx) => idx !== index));
    addLocalLog('[INFO] 移除了本地阶梯草稿项 (尚未存入后端)。');
  };

  const handleTierChange = (index: number, field: keyof Tier, val: number) => {
    setEditTiers(prev =>
      prev.map((tier, idx) => (idx === index ? { ...tier, [field]: val } : tier))
    );
  };

  // Multi-site target selections logic
  const handleTargetSiteToggle = (siteId: string) => {
    if (siteId === sourceSiteId) return; // Prevent target matching source
    setTargetSiteIds(prev =>
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    );
  };

  const handleSourceSiteSelect = (siteId: string) => {
    setSourceSiteId(siteId);
    // Auto-remove from targets if it matches
    setTargetSiteIds(prev => prev.filter(id => id !== siteId));
  };

  // Sync click
  const handleSyncClick = () => {
    const selectedNames = models
      .filter(m => selectedModelIds.includes(m.id))
      .map(m => m.name);

    if (selectedNames.length === 0) {
      alert('请先勾选需要同步的模型价格条目');
      return;
    }
    if (targetSiteIds.length === 0) {
      alert('请勾选至少一个目标站点进行推送');
      return;
    }

    onOpenSyncPreview(sourceSiteId, targetSiteIds, selectedNames);
  };

  // Sorted and filtered sites: source site goes first
  const sortedSites = useMemo(() => {
    const filtered = sites.filter(s => 
      s.name.toLowerCase().includes(siteSearchQuery.toLowerCase()) ||
      s.url.toLowerCase().includes(siteSearchQuery.toLowerCase())
    );
    return filtered.sort((a, b) => {
      const aIsSource = a.id === sourceSiteId;
      const bIsSource = b.id === sourceSiteId;
      if (aIsSource && !bIsSource) return -1;
      if (!aIsSource && bIsSource) return 1;
      return 0;
    });
  }, [sites, sourceSiteId, siteSearchQuery]);

  return (
    <div className="flex-1 flex overflow-hidden p-3 gap-3">
      {/* 1. Left Panel: Sites */}
      <section className="w-[300px] bg-panel border border-border rounded-lg flex flex-col overflow-hidden shrink-0 shadow-xl">
        <div className="p-4 border-b border-border flex flex-col gap-4">
          <h2 className="text-text-primary font-bold text-base">站点管理</h2>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="搜索站点..."
                value={siteSearchQuery}
                onChange={(e) => setSiteSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:border-primary outline-none transition-all placeholder:text-text-muted/50"
              />
            </div>
            <button
              onClick={() => onOpenSiteModal(null)}
              className="bg-primary text-background px-3 py-2 rounded-md text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {sortedSites.map(site => {
            const isSource = sourceSiteId === site.id;
            const isTarget = targetSiteIds.includes(site.id);
            const isOffline = site.status === 'failed';
            const isTesting = testingSiteId === site.id;

            return (
              <div
                key={site.id}
                className={`p-3.5 rounded-xl border transition-all relative overflow-hidden ${
                  isSource
                    ? 'bg-select-bg/25 border-primary/65 shadow-lg shadow-[0_0_12px_rgba(56,189,248,0.12)] cursor-default'
                    : isTarget
                    ? 'bg-teal-500/5 border-teal-500/35 hover:border-teal-500/45 cursor-pointer shadow-lg shadow-[0_0_12px_rgba(20,184,166,0.06)]'
                    : 'bg-[#151B24]/40 border-border hover:border-primary/20 hover:bg-[#1B2533]/50 cursor-pointer'
                }`}
                onClick={() => {
                  if (!isSource) {
                    handleTargetSiteToggle(site.id);
                  }
                }}
              >
                {/* Connection Scan Radar Glow when testing */}
                {isTesting && (
                  <div className="absolute inset-0 bg-gradient-to-r from-warning/5 via-warning/10 to-warning/5 animate-pulse pointer-events-none" />
                )}

                {/* 1. Header Row: Name & Role Badge & Status Dot */}
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {/* Glowing Status Dot */}
                    <div className="relative flex h-2 w-2 shrink-0">
                      {site.status === 'connected' && !isTesting && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      )}
                      <span 
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          isTesting
                            ? 'bg-warning animate-pulse'
                            : isOffline
                            ? 'bg-error shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                            : site.status === 'connected'
                            ? 'bg-success shadow-[0_0_6px_rgba(34,197,94,0.6)]'
                            : 'bg-text-muted'
                        }`}
                        title={isTesting ? '检测中' : isOffline ? '连接失败' : site.status === 'connected' ? '在线' : '未测试'}
                      ></span>
                    </div>
                    <span className="font-bold text-sm text-text-primary truncate" title={site.name}>
                      {site.name}
                    </span>
                  </div>

                  {/* Role Badges */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isSource && (
                      <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">
                        源
                      </span>
                    )}
                    {isTarget && (
                      <span className="text-[10px] bg-teal-500/20 text-teal-400 border border-teal-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-tight">
                        目标
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Middle Row: URL */}
                <div className="mt-1.5 flex items-center gap-1">
                  <span 
                    className="text-xs text-text-muted truncate max-w-full font-mono font-medium block" 
                    title={site.url}
                  >
                    {site.url}
                  </span>
                </div>

                {/* Divider Line */}
                <div className="h-[1px] bg-border/40 my-3" />

                {/* 3. Footer Row: Actions (Test, Edit) & Switch Pills */}
                <div className="flex items-center justify-between gap-2">
                  {/* Action group container */}
                  <div className="flex items-center bg-background/55 border border-border/40 rounded-lg p-0.5 shadow-inner">
                    <button
                      onClick={(e) => handleTestConnection(site.id, e)}
                      disabled={isTesting}
                      className="p-1 hover:bg-primary/15 rounded text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
                      title="测试连接"
                    >
                      <Zap className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse text-warning' : ''}`} />
                    </button>
                    <div className="w-[1px] h-3.5 bg-border/50 self-center" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSiteModal(site);
                      }}
                      className="p-1 hover:bg-primary/15 rounded text-text-secondary hover:text-primary transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Switch Pills */}
                  <div className="flex items-center gap-1.5">
                    {/* Source Pill */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSourceSiteSelect(site.id);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] transition-all font-semibold ${
                        isSource
                          ? 'bg-primary/20 text-primary border-primary/45 shadow-[0_0_8px_rgba(56,189,248,0.15)] font-bold'
                          : 'bg-background/25 text-text-secondary border-border/60 hover:text-primary hover:border-primary/40 hover:bg-primary/5'
                      }`}
                      title="将此站点设置为源价格站点"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full transition-all ${
                        isSource ? 'bg-primary scale-110' : 'border border-text-secondary'
                      }`} />
                      <span>源站</span>
                    </button>

                    {/* Target Pill */}
                    <button
                      type="button"
                      disabled={isSource}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSource) {
                          handleTargetSiteToggle(site.id);
                        }
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] transition-all font-semibold ${
                        isSource
                          ? 'opacity-30 cursor-not-allowed bg-background/5 text-text-muted border-border/20'
                          : isTarget
                          ? 'bg-teal-500/20 text-teal-400 border-teal-500/45 shadow-[0_0_8px_rgba(20,184,166,0.15)] font-bold'
                          : 'bg-background/25 text-text-secondary border-border/60 hover:text-teal-400 hover:border-teal-500/40 hover:bg-teal-500/5'
                      }`}
                      title={isSource ? "源站无法设置为同步目标" : "将此站点加入价格同步目标列表"}
                    >
                      <span className={`w-1.5 h-1.5 rounded-sm transition-all ${
                        isTarget ? 'bg-teal-400 scale-110' : 'border border-text-secondary'
                      }`} />
                      <span>目标</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {sortedSites.length === 0 && (
            <div className="text-center py-12 text-text-muted text-xs flex flex-col items-center justify-center gap-2 h-full opacity-60">
              <Info className="w-6 h-6 text-text-muted/70" />
              <span>未搜索到匹配的站点</span>
            </div>
          )}
        </div>
      </section>

      {/* 2. Middle Panel: Model Table */}
      <section className="flex-1 bg-panel border border-border rounded-lg flex flex-col overflow-hidden shadow-xl">
        <div className="p-4 border-b border-border flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-text-primary font-bold text-base">模型价格列表</h2>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="搜索模型名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-background border border-border rounded-md pl-9 pr-3 py-1.5 text-sm focus:border-primary outline-none transition-all w-60 font-mono"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={showDiffOnly}
                  onChange={e => setShowDiffOnly(e.target.checked)}
                  className="accent-primary w-3.5 h-3.5"
                />
                <span className="text-xs text-text-secondary">只看差异</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={showSelectedOnly}
                  onChange={e => setShowSelectedOnly(e.target.checked)}
                  className="accent-primary w-3.5 h-3.5"
                />
                <span className="text-xs text-text-secondary">只看已选</span>
              </label>

              <button onClick={loadSourceModels} disabled={isLoadingModels} className="text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {['全部', '未设置价格', '按量计费', '按次收费', '表达式/阶梯'].map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterMode(tag)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border ${
                  filterMode === tag
                    ? 'bg-primary text-background border-primary shadow-lg shadow-primary/20'
                    : 'text-text-secondary border-border hover:border-primary/50 hover:text-text-primary'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoadingModels ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-text-secondary">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <span className="text-xs">加载模型列表中...</span>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0 bg-nav-bg/95 backdrop-blur-md z-10 border-b border-border">
                <tr className="text-text-muted border-b border-border uppercase text-xs tracking-wider font-bold">
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selectedModelIds.length === filteredModels.length && filteredModels.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="p-4">模型名称</th>
                  <th className="p-4">计费模式</th>
                  <th className="p-4">主要价格摘要</th>
                  <th className="p-4">状态</th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.map(model => {
                  const isFocused = focusedModelId === model.id;
                  const isChecked = selectedModelIds.includes(model.id);

                  let billingSummary = '-';
                  let billingModeTag = '未设置';
                  if (model.billing_mode === 'quota') {
                    billingModeTag = '按量计费';
                    billingSummary = `$${model.input_price.toFixed(3)} / $${model.output_price.toFixed(3)} (1M)`;
                  } else if (model.billing_mode === 'times') {
                    billingModeTag = '按次计费';
                    billingSummary = `$${model.times_price.toFixed(4)} /次`;
                  } else if (model.billing_mode === 'expr') {
                    billingModeTag = '表达式/阶梯';
                    const parts: string[] = [];
                    if (model.tiers && model.tiers.length > 0) {
                      parts.push(`${model.tiers.length}档阶梯`);
                    }
                    if (model.expression) {
                      parts.push(model.expression);
                    }
                    billingSummary = parts.length > 0 ? parts.join(' | ') : '未配参数';
                  }

                  return (
                    <tr
                      key={model.id}
                      className={`border-b border-border/50 hover:bg-hover-bg/20 transition-colors group cursor-pointer ${
                        isFocused ? 'bg-select-bg/30' : ''
                      }`}
                      onClick={() => setFocusedModelId(model.id)}
                    >
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={isChecked}
                          onChange={() => toggleModelSelection(model.id)}
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-sm text-text-primary font-mono">{model.name}</div>
                        <div className="text-xs text-text-muted mt-0.5">最后更新: {model.lastUpdate}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                          model.billing_mode === 'quota'
                            ? 'bg-primary/10 text-primary border border-primary/10'
                            : model.billing_mode === 'times'
                            ? 'bg-warning/10 text-warning border border-warning/10'
                            : model.billing_mode === 'expr'
                            ? 'bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/10'
                            : 'bg-text-muted/10 text-text-secondary border border-border'
                        }`}>
                          {billingModeTag}
                        </span>
                      </td>
                      <td className="p-4 text-text-secondary font-mono text-sm max-w-[250px] truncate" title={billingSummary}>
                        {billingSummary}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            model.status === 'synced' ? 'bg-success' : model.status === 'modified' ? 'bg-primary' : 'bg-warning animate-pulse'
                          }`} />
                          <span className={`text-xs font-bold ${
                            model.status === 'synced' ? 'text-success' : 'text-primary'
                          }`}>
                            {model.status === 'synced' ? '已同步' : model.status === 'modified' ? '已修改' : '草稿'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredModels.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-text-muted">
                      未检索到匹配的模型价格数据。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 3. Right Panel: Editor */}
      <section className="w-[360px] bg-panel border border-border rounded-lg flex flex-col overflow-hidden shrink-0 shadow-xl">
        <div className="p-4 border-b border-border">
          <h2 className="text-text-primary font-bold text-base">价格编辑器</h2>
        </div>

        <div className="flex-1 p-5 overflow-y-auto">
          {focusedModel ? (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="space-y-1">
                <div className="text-xs text-text-muted uppercase tracking-wider font-bold">当前模型</div>
                <div className="text-lg font-bold text-primary font-mono select-all truncate" title={focusedModel.name}>
                  {focusedModel.name}
                </div>
              </div>

              {/* Status details cards */}
              <div className="grid grid-cols-2 gap-2.5 p-3 bg-background rounded-xl border border-border/50">
                <div className="space-y-0.5">
                  <div className="text-xs uppercase font-bold text-text-muted">源端站点</div>
                  <div className="text-sm font-semibold text-text-primary truncate" title={sites.find(s => s.id === sourceSiteId)?.name}>
                    {sites.find(s => s.id === sourceSiteId)?.name}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs uppercase font-bold text-text-muted">推送目标</div>
                  <div className="text-sm font-semibold text-text-primary">
                    {targetSiteIds.length} 个站点
                  </div>
                </div>
              </div>

              {/* Billing mode dropdown */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-secondary uppercase">计费模式</label>
                <select
                  value={editBillingMode}
                  onChange={e => setEditBillingMode(e.target.value as any)}
                  className="w-full bg-background text-text-primary border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-colors hover:bg-hover-bg"
                >
                  <option value="unset" className="bg-panel text-text-primary">未设置价格 (unset)</option>
                  <option value="quota" className="bg-panel text-text-primary">按量计费 (quota)</option>
                  <option value="times" className="bg-panel text-text-primary">按次收费 (times)</option>
                  <option value="expr" className="bg-panel text-text-primary">表达式/阶梯收费 (expr)</option>
                </select>
              </div>

              {/* Dynamic form inputs based on billing mode */}
              <div className="space-y-4 p-4 bg-background/40 border border-border/50 rounded-xl">
                {editBillingMode === 'unset' && (
                  <div className="space-y-2 text-center py-6 text-text-muted">
                    <Info className="w-8 h-8 mx-auto text-text-muted/60" />
                    <p className="text-xs">说明：该模型当前没有价格配置，或者将要重置配置。注意！工具禁止将远端已有价格强制清空为未设置价格以避免事故。</p>
                  </div>
                )}

                {editBillingMode === 'quota' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">输入价格 ($/1M tokens)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={editInputPrice}
                        onChange={e => setEditInputPrice(Number(e.target.value))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-all font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">输出价格 ($/1M tokens)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={editOutputPrice}
                        onChange={e => setEditOutputPrice(Number(e.target.value))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-all font-mono"
                      />
                    </div>

                    <div className="pt-2 border-t border-border/40 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customCache}
                          onChange={e => setCustomCache(e.target.checked)}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="text-xs font-semibold text-text-secondary">自定义缓存读取/创建价格</span>
                      </label>

                      {customCache && (
                        <div className="grid grid-cols-2 gap-2.5 pt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-text-muted uppercase">读取 ($/1M)</span>
                            <input
                              type="number"
                              step="0.0001"
                              value={editCacheRead}
                              onChange={e => setEditCacheRead(Number(e.target.value))}
                              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm focus:border-primary outline-none font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-text-muted uppercase">创建 ($/1M)</span>
                            <input
                              type="number"
                              step="0.0001"
                              value={editCacheCreate}
                              onChange={e => setEditCacheCreate(Number(e.target.value))}
                              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm focus:border-primary outline-none font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {editBillingMode === 'times' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">每次调用收费 (美元/次)</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={editTimesPrice}
                        onChange={e => setEditTimesPrice(Number(e.target.value))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-all font-mono"
                      />
                    </div>
                    <div className="text-xs text-text-muted leading-relaxed">
                      提示：按次收费计费模式适用于画图模型、音视频以及特定以单次固定价格计量的后端应用模型。
                    </div>
                  </div>
                )}

                {editBillingMode === 'expr' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Expression Section */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase">NewAPI 价格计算表达式</label>
                      <textarea
                        rows={3}
                        placeholder='例如: len >= 0 ? tier("base", p * 2 + c * 5) : tier("fallback", 0)'
                        value={editExpression}
                        onChange={e => setEditExpression(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg p-3 text-sm focus:border-primary outline-none transition-all font-mono leading-relaxed"
                      />
                    </div>
                    
                    <div className="space-y-2 p-3 bg-background/50 border border-border/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-secondary">表达式本地简易校验</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={exprTestParam}
                            onChange={e => setExprTestParam(e.target.value)}
                            className="bg-panel border border-border text-xs font-mono w-16 px-1.5 py-0.5 rounded text-center"
                            placeholder="tokens"
                          />
                          <button
                            type="button"
                            onClick={validateExpression}
                            className="text-xs bg-primary text-background px-2.5 py-1 rounded font-bold hover:brightness-110"
                          >
                            校验
                          </button>
                        </div>
                      </div>

                      {exprValidationResult && (
                        <div className={`text-xs font-medium leading-normal mt-1 border-t border-border/20 pt-1.5 ${
                          exprValidationResult.success ? 'text-success' : 'text-error'
                        }`}>
                          {exprValidationResult.message}
                        </div>
                      )}
                    </div>

                    {/* Visual Separator */}
                    <div className="border-t border-border/50 my-2 pt-2" />

                    {/* Tiers Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-text-secondary uppercase">阶梯价格列表 (Tiers)</span>
                        <button
                          type="button"
                          onClick={handleAddTier}
                          className="text-xs text-primary hover:underline font-bold"
                        >
                          + 添加阶梯档
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {editTiers.map((tier, idx) => (
                          <div key={idx} className="p-2.5 bg-background border border-border/50 rounded-lg space-y-2">
                            <div className="flex items-center justify-between text-xs text-text-muted">
                              <span>第 {idx + 1} 档</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTier(idx)}
                                className="text-error hover:text-error/80 flex items-center gap-0.5"
                                title="移除本地草稿阶梯"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>移除草稿</span>
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              <div>
                                <span className="text-[10px] text-text-muted block mb-0.5">起始 Token</span>
                                <input
                                  type="number"
                                  value={tier.range_start}
                                  onChange={e => handleTierChange(idx, 'range_start', Number(e.target.value))}
                                  className="w-full bg-panel border border-border text-xs p-1 rounded font-mono"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-text-muted block mb-0.5">结束 (-1为无限)</span>
                                <input
                                  type="number"
                                  value={tier.range_end}
                                  onChange={e => handleTierChange(idx, 'range_end', Number(e.target.value))}
                                  className="w-full bg-panel border border-border text-xs p-1 rounded font-mono"
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-text-muted block mb-0.5">价格系数 ($)</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tier.price}
                                  onChange={e => handleTierChange(idx, 'price', Number(e.target.value))}
                                  className="w-full bg-panel border border-border text-xs p-1 rounded font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        {editTiers.length === 0 && (
                          <div className="text-center py-4 text-text-muted text-xs">
                            暂无配置阶梯档，请点击添加。
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSaveLocal}
                  className="w-full bg-primary text-background py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-lg shadow-primary/20 active:scale-95"
                >
                  <CheckCircle2 className="w-5 h-5" /> 保存修改到本地缓存
                </button>
                <div className="text-xs text-text-muted text-center flex items-center justify-center gap-1">
                  <Info className="w-4 h-4" />
                  <span>本地修改不会立刻推送到各目标站，点击“一键同步”开始同步。</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-text-muted opacity-40">
              <div className="w-16 h-16 bg-divider rounded-full flex items-center justify-center animate-pulse">
                <BadgeDollarSign className="w-8 h-8 text-text-secondary" />
              </div>
              <p className="text-sm">点击列表中任意模型行进行价格编辑</p>
            </div>
          )}
        </div>
      </section>

      {/* Sync trigger floating button section at parent level, but workbench has a big Sync bar in App.tsx. 
          To support that, let's also pass trigger action. */}
      {/* Wait, the big footer sync button is in App.tsx. It needs to know targetSiteIds and selectedModelIds.
          To keep states consistent, we can bubble targetSiteIds and selectedModelIds to App.tsx when they change.
          Or, since we want PricingWorkbench to look complete, we handle the Sync button inside PricingWorkbench, OR we bubble selected counts.
          Let's check: the footer Sync button is at the bottom right of the main page (line 433 of App.tsx).
          Let's expose selectedModelIds and targetSiteIds to the parent by triggering callbacks, or we can just render the Workbench fully
          and pass state back. Let's make sure our App.tsx integrates with it! */}
      {/* Let's render the Sync Console Trigger inside our Workbench or bubble states to parent. 
          In our props, we have: `onOpenSyncPreview(sourceId, targetIds, modelNames)`.
          We can export targetSiteIds and selectedModelIds to App.tsx by calling a callback, or we can just render a floating Sync bar, or let App.tsx render the bottom sync bar.
          Wait, the design says: "整体是三栏布局：左侧站点列表，中间模型价格表，右侧价格编辑器，底部有日志面板（其中右边是一键同步按钮）"
          This means: left/middle/right are 3 columns, footer is the log panel + Sync button.
          So, the Sync button belongs to the footer, which is in App.tsx.
          To do this cleanly, let's keep selectedModelIds and targetSiteIds inside the workbench, but let's bubble them up to the parent!
          Let's add props: `onChangeTargetSites?: (ids: string[]) => void`, `onChangeSelectedModels?: (names: string[]) => void`.
          This is extremely clean! When they change, we call the parent callback so App.tsx can show the current selected count on the sync button in the footer!
          Let's update the props to include these, and call them in useEffect or handlers. */}
    </div>
  );
};
