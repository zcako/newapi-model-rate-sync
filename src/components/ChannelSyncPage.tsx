import React, { useState, useEffect, useMemo } from 'react';
import { 
  Server, 
  Radar, 
  Info, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Search, 
  Check, 
  X, 
  Lock, 
  Layers, 
  RefreshCw,
  Terminal,
  Activity,
  Globe,
  Settings,
} from 'lucide-react';
import { apiService, addLocalLog, getSummary, Site } from '../services/api';
import { SyncPriceConfirmModal } from './SyncPriceConfirmModal';

interface ChannelSyncPageProps {
  sites: Site[];
  sourceSiteId: string;
  onSwitchTab: (tabId: string) => void;
}

interface ScannedModel {
  name: string;
  upstream_supported: boolean;
  local_enabled: boolean;
  status: 'new' | 'exists' | 'removed';
}

export const ChannelSyncPage: React.FC<ChannelSyncPageProps> = ({ sites, sourceSiteId, onSwitchTab }) => {
  // 1. Site and Channel Select States
  const activeSites = useMemo(() => sites.filter(s => s.status === 'connected'), [sites]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [loadingChannels, setLoadingChannels] = useState(false);
  
  // 2. Selected Channel Details
  const selectedChannel = useMemo(() => {
    return channels.find(c => c.id === selectedChannelId) || null;
  }, [channels, selectedChannelId]);

  // 3. Scan & Sync States
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scannedModels, setScannedModels] = useState<ScannedModel[]>([]);
  const [selectedModelNames, setSelectedModelNames] = useState<string[]>([]);
  
  // 4. Filters & Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [autoAddPricing, setAutoAddPricing] = useState(true);
  const resetAll = false;
  
  // 5. Confirmation Modal States
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState<{
    sourceSiteName: string;
    targetSiteName: string;
    isSelfSync: boolean;
    modelsToCopy: { name: string; pricingSummary: string }[];
    modelsToUnset: string[];
  } | null>(null);

  // Initialize: Select the first connected site (or just the first site)
  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      const connectedSite = sites.find(s => s.status === 'connected');
      setSelectedSiteId(connectedSite ? connectedSite.id : sites[0].id);
    }
  }, [sites, selectedSiteId]);

  // Fetch channels when site changes
  useEffect(() => {
    if (!selectedSiteId) {
      setChannels([]);
      setSelectedChannelId('');
      setScannedModels([]);
      setHasScanned(false);
      setSelectedModelNames([]);
      return;
    }

    let isMounted = true;
    const fetchChannels = async () => {
      setLoadingChannels(true);
      try {
        const channelList = await apiService.listChannels(selectedSiteId);
        if (isMounted) {
          setChannels(channelList);
          if (channelList.length > 0) {
            setSelectedChannelId(channelList[0].id);
          } else {
            setSelectedChannelId('');
          }
          // Clear scan results when site changes
          setScannedModels([]);
          setHasScanned(false);
          setSelectedModelNames([]);
        }
      } catch (err) {
        console.error("加载渠道列表失败", err);
        addLocalLog(`[ERROR] 加载渠道列表失败: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (isMounted) setLoadingChannels(false);
      }
    };

    fetchChannels();
    return () => {
      isMounted = false;
    };
  }, [selectedSiteId]);

  // Clear scan results when selected channel changes
  useEffect(() => {
    setScannedModels([]);
    setHasScanned(false);
    setSelectedModelNames([]);
  }, [selectedChannelId]);

  // Perform Scan
  const handleScan = async () => {
    if (!selectedSiteId || !selectedChannelId) {
      alert('请选择有效的站点和渠道进行扫描！');
      return;
    }

    setIsScanning(true);
    setHasScanned(false);
    setSelectedModelNames([]);
    
    const channelName = selectedChannel ? selectedChannel.name : selectedChannelId;
    addLocalLog(`[INFO] 开始扫描渠道 [${channelName}] 的上游模型差异...`);

    try {
      const results = await apiService.scanChannelUpstreamModels(selectedSiteId, selectedChannelId);
      setScannedModels(results);
      // Auto-select all new models by default
      const newModels = results.filter(m => m.status === 'new').map(m => m.name);
      setSelectedModelNames(newModels);
      setHasScanned(true);
      addLocalLog(`[SUCCESS] 渠道 [${channelName}] 上游比对完成。上游支持 ${results.filter(r => r.upstream_supported).length} 个模型，本地已开启 ${results.filter(r => r.local_enabled).length} 个模型。`);
    } catch (err) {
      console.error("扫描渠道上游失败", err);
      addLocalLog(`[ERROR] 扫描上游模型列表失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Actual Sync Action Execution
  const executeSyncAction = async () => {
    setIsSyncing(true);
    const channelName = selectedChannel ? selectedChannel.name : selectedChannelId;
    addLocalLog(`[INFO] 正在下发渠道 [${channelName}] 的模型同步配置...`);

    try {
      const result = await apiService.syncChannelModels(
        selectedSiteId,
        selectedChannelId,
        selectedModelNames,
        {
          autoAddPricing,
          resetAll,
          sourceSiteId
        }
      );

      if (result.success) {
        addLocalLog(`[INFO] 同步指令成功应用。正在自动重新扫描以载入最新状态...`);
        // Refresh scanned models after successful sync
        const updatedResults = await apiService.scanChannelUpstreamModels(selectedSiteId, selectedChannelId);
        setScannedModels(updatedResults);
        // Clear selection to align with the new state
        const newModels = updatedResults.filter(m => m.status === 'new').map(m => m.name);
        setSelectedModelNames(newModels);
        addLocalLog(`[SUCCESS] 渠道 [${channelName}] 同步对齐完毕，所有状态已刷新。`);

        if (selectedSiteId === sourceSiteId && selectedModelNames.length > 0) {
          const confirmGoToPricing = window.confirm(
            `【提示】源站渠道自同步已完成！已为以下 ${selectedModelNames.length} 个新模型生成了默认未设置的价格配置：\n${selectedModelNames.map(m => ` - ${m}`).join('\n')}\n\n是否立即跳转到模型价格设置页面进行定价？`
          );
          if (confirmGoToPricing) {
            onSwitchTab('pricing');
            return;
          }
        }
      } else {
        addLocalLog(`[ERROR] 渠道模型同步返回失败。`);
      }
    } catch (err) {
      console.error("同步模型失败", err);
      addLocalLog(`[ERROR] 同步模型失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Perform Sync Trigger and Pre-Sync Confirmation
  const handleSync = async () => {
    if (!selectedSiteId || !selectedChannelId) return;
    
    // Check if there is anything to sync
    if (selectedModelNames.length === 0) {
      alert('没有选中的新模型，无需同步。');
      return;
    }

    // Check if pricing needs copy configuration confirmation
    if (autoAddPricing && selectedModelNames.length > 0) {
      try {
        setIsSyncing(true); // Show loading state while querying pricing info
        const targetModels = await apiService.loadSiteModels(selectedSiteId);
        const sourceModels = await apiService.loadSiteModels(sourceSiteId);
        setIsSyncing(false);

        const targetModelNamesSet = new Set(targetModels.map(m => m.name));
        const modelsToBeInitialized = selectedModelNames.filter(name => !targetModelNamesSet.has(name));

        if (modelsToBeInitialized.length > 0) {
          const isSelfSync = selectedSiteId === sourceSiteId;
          const sourceSiteName = sites.find(s => s.id === sourceSiteId)?.name || '源站';
          const targetSiteName = sites.find(s => s.id === selectedSiteId)?.name || '目标站';

          const copyList: { name: string; pricingSummary: string }[] = [];
          const unsetList: string[] = [];

          modelsToBeInitialized.forEach(name => {
            const srcModel = sourceModels.find(m => m.name === name);
            if (srcModel && srcModel.billing_mode !== 'unset') {
              copyList.push({
                name,
                pricingSummary: getSummary(srcModel)
              });
            } else {
              unsetList.push(name);
            }
          });

          // Open custom confirmation modal
          setConfirmModalData({
            sourceSiteName,
            targetSiteName,
            isSelfSync,
            modelsToCopy: copyList,
            modelsToUnset: unsetList
          });
          setConfirmModalOpen(true);
          return; // Wait for modal action
        }
      } catch (err) {
        console.error("加载站点价格数据失败", err);
        addLocalLog(`[ERROR] 校验同步价格差异失败: ${err instanceof Error ? err.message : String(err)}`);
        setIsSyncing(false);
      }
    }

    // Fallback: Proceed directly to sync execution
    await executeSyncAction();
  };

  // Filter scanned models
  const filteredModels = useMemo(() => {
    return scannedModels.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'all' || m.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [scannedModels, searchQuery, filterStatus]);

  // Count models helper
  const countSummary = useMemo(() => {
    return {
      total: scannedModels.length,
      new: scannedModels.filter(m => m.status === 'new').length,
      exists: scannedModels.filter(m => m.status === 'exists').length,
      removed: scannedModels.filter(m => m.status === 'removed').length,
    };
  }, [scannedModels]);

  const handleModelCheckboxChange = (modelName: string) => {
    setSelectedModelNames(prev =>
      prev.includes(modelName)
        ? prev.filter(name => name !== modelName)
        : [...prev, modelName]
    );
  };

  // Channel Brand Styling Helpers
  const getChannelBrandStyle = (type: string) => {
    const defaultStyle = { bg: 'bg-divider/50', border: 'border-border/60', text: 'text-text-secondary', badge: 'bg-text-muted/10 text-text-secondary' };
    const styles: Record<string, typeof defaultStyle> = {
      openai: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400' },
      anthropic: { bg: 'bg-orange-500/5', border: 'border-orange-500/20', text: 'text-orange-400', badge: 'bg-orange-500/10 text-orange-400' },
      deepseek: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400' },
      gemini: { bg: 'bg-indigo-500/5', border: 'border-indigo-500/20', text: 'text-indigo-400', badge: 'bg-indigo-500/10 text-indigo-400' },
    };
    return styles[type.toLowerCase()] || defaultStyle;
  };

  const getStatusBadge = (status: ScannedModel['status']) => {
    switch (status) {
      case 'new':
        return (
          <span className="px-2.5 py-1 rounded-full bg-success/15 text-success text-xs font-bold flex items-center gap-1 w-max">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            新模型
          </span>
        );
      case 'exists':
        return (
          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3 h-3 text-primary" />
            已对齐
          </span>
        );
      case 'removed':
        return (
          <span className="px-2.5 py-1 rounded-full bg-warning/15 text-warning text-xs font-bold flex items-center gap-1 w-max">
            <AlertTriangle className="w-3 h-3 text-warning" />
            上游已下线
          </span>
        );
      default:
        return null;
    }
  };

  const getRecommendedAction = (model: ScannedModel) => {
    if (model.status === 'new') {
      return <span className="text-success font-medium flex items-center gap-1">&rarr; 勾选并同步开启</span>;
    }
    if (model.status === 'exists') {
      return <span className="text-text-muted">已同步, 无需操作</span>;
    }
    if (model.status === 'removed') {
      return <span className="text-warning font-medium flex items-center gap-1">安全模式: 本地保留</span>;
    }
    return null;
  };

  return (
    <div className="flex-1 flex overflow-hidden gap-3 p-3 bg-background">
      
      {/* 1. Left Panel: Site & Channel Select */}
      <section className="w-[330px] bg-panel border border-border rounded-xl flex flex-col overflow-hidden shrink-0 shadow-2xl">
        <div className="p-4 border-b border-border bg-gradient-to-b from-panel/30 to-panel/10">
          <h2 className="text-text-primary font-bold text-base flex items-center gap-2">
            <Server className="w-4.5 h-4.5 text-primary" />
            渠道自同步
          </h2>
          <p className="text-xs text-text-muted mt-1">单个站点渠道向其上游接口拉取模型对齐</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Site selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-primary" /> 1. 选择目标站点
            </label>
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
              className="w-full bg-background text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-colors hover:bg-hover-bg"
            >
              <option value="" disabled className="bg-panel text-text-primary">-- 请选择站点 --</option>
              {sites.map(s => (
                <option key={s.id} value={s.id} className="bg-panel text-text-primary">
                  {s.name} ({s.status === 'connected' ? '在线' : '离线'})
                </option>
              ))}
            </select>
          </div>

          {/* Channel selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-primary" /> 2. 选择待同步渠道
            </label>
            {loadingChannels ? (
              <div className="text-xs text-text-muted flex items-center gap-2 p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                正在载入渠道...
              </div>
            ) : channels.length === 0 ? (
              <div className="p-3 bg-divider/10 border border-border/40 rounded-lg text-xs text-text-muted">
                当前站点下无可用渠道，请先去工作台添加或测试站点。
              </div>
            ) : (
              <select
                value={selectedChannelId}
                onChange={e => setSelectedChannelId(e.target.value)}
                className="w-full bg-background text-text-primary border border-border rounded-lg px-3 py-2 text-sm focus:border-primary outline-none transition-colors hover:bg-hover-bg"
              >
                {channels.map(c => (
                  <option key={c.id} value={c.id} className="bg-panel text-text-primary">
                    [{c.type.toUpperCase()}] {c.name} (ID: {c.id})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Channel metadata card */}
          {selectedChannel && (
            <div className={`p-4 rounded-xl border transition-all ${getChannelBrandStyle(selectedChannel.type).bg} ${getChannelBrandStyle(selectedChannel.type).border}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs uppercase font-black px-2.5 py-1 rounded ${getChannelBrandStyle(selectedChannel.type).badge}`}>
                  {selectedChannel.type}
                </span>
                <span className="text-xs text-text-muted">ID: {selectedChannel.id}</span>
              </div>
              <h4 className="font-bold text-sm text-text-primary mt-2 truncate" title={selectedChannel.name}>
                {selectedChannel.name}
              </h4>
              <div className="mt-3 space-y-1.5 text-xs text-text-secondary">
                <div className="flex justify-between">
                  <span className="text-text-muted">代理地址:</span>
                  <span className="font-mono truncate max-w-[150px] text-right" title={selectedChannel.base_url}>
                    {selectedChannel.base_url}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">本地模型数:</span>
                  <span className="font-mono font-bold text-text-primary">{selectedChannel.models?.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={isScanning || !selectedChannelId}
            className="w-full bg-primary hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 text-background py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
          >
            <Radar className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            {isScanning ? '正在请求上游并比对...' : '开始扫描上游模型'}
          </button>
        </div>
      </section>

      {/* 2. Middle Panel: Comparison Table */}
      <section className="flex-1 bg-panel border border-border rounded-xl flex flex-col overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-border flex items-center justify-between bg-gradient-to-b from-panel/30 to-panel/10">
          <div>
            <h2 className="text-text-primary font-bold text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary animate-pulse" />
              对比分析视图
            </h2>
            <p className="text-xs text-text-muted mt-0.5">上游最新发布模型与本地已启用配置的模型差异</p>
          </div>
          
          {hasScanned && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input
                  type="text"
                  placeholder="过滤模型名称..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:border-primary outline-none transition-colors w-40 placeholder:text-text-muted/60"
                />
              </div>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-background text-text-primary border border-border rounded-lg px-2 py-1.5 text-xs focus:border-primary outline-none transition-colors hover:bg-hover-bg"
              >
                <option value="all" className="bg-panel text-text-primary">显示全部 ({countSummary.total})</option>
                <option value="new" className="bg-panel text-text-primary">新模型 ({countSummary.new})</option>
                <option value="exists" className="bg-panel text-text-primary">已对齐 ({countSummary.exists})</option>
                <option value="removed" className="bg-panel text-text-primary">上游已下线 ({countSummary.removed})</option>
              </select>
            </div>
          )}
        </div>

        {/* Comparison List Body */}
        <div className="flex-1 overflow-auto">
          {!hasScanned ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-text-muted/50 p-8">
              <div className="w-16 h-16 bg-divider rounded-full flex items-center justify-center animate-pulse">
                <Radar className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center space-y-1 max-w-[320px]">
                <p className="text-sm font-bold text-text-primary">请启动扫描</p>
                <p className="text-xs">选择需要同步的站点及渠道，点击左侧按钮向该渠道的上游抓取可用的模型列表，即可生成对比报告。</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-panel/95 backdrop-blur-md z-10 border-b border-border">
                <tr className="text-text-muted font-bold uppercase tracking-wider text-xs">
                  <th className="p-4 w-12">
                    <input
                      type="checkbox"
                      className="accent-primary rounded w-3.5 h-3.5"
                      checked={
                        filteredModels.filter(m => m.status === 'new').length > 0 &&
                        filteredModels.filter(m => m.status === 'new').every(m => selectedModelNames.includes(m.name))
                      }
                      onChange={e => {
                        const newModelNames = filteredModels.filter(m => m.status === 'new').map(m => m.name);
                        if (e.target.checked) {
                          setSelectedModelNames(prev => Array.from(new Set([...prev, ...newModelNames])));
                        } else {
                          setSelectedModelNames(prev => prev.filter(name => !newModelNames.includes(name)));
                        }
                      }}
                    />
                  </th>
                  <th className="p-4">模型名称</th>
                  <th className="p-4 text-center">上游支持</th>
                  <th className="p-4 text-center">本地开启</th>
                  <th className="p-4">状态</th>
                  <th className="p-4">操作推荐</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredModels.map(model => {
                  const isNew = model.status === 'new';
                  const isRemoved = model.status === 'removed';
                  const isSelected = selectedModelNames.includes(model.name);
                  
                  // Row highlighting
                  let rowClass = 'hover:bg-hover-bg/10 transition-colors';
                  if (isRemoved) {
                    rowClass += ' bg-warning/5 hover:bg-warning/10';
                  } else if (isNew) {
                    rowClass += ' bg-success/5 hover:bg-success/10';
                  }

                  return (
                    <tr key={model.name} className={rowClass}>
                      <td className="p-4">
                        <input
                          type="checkbox"
                          className="accent-primary rounded w-3.5 h-3.5 disabled:opacity-40"
                          checked={isNew ? isSelected : (model.status === 'exists')}
                          disabled={!isNew}
                          onChange={() => handleModelCheckboxChange(model.name)}
                        />
                      </td>
                      <td className="p-4 font-mono font-medium text-text-primary select-all">
                        <div className="flex items-center gap-1.5">
                          <span>
                            {model.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          {model.upstream_supported ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <X className="w-4 h-4 text-text-muted" />
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          {model.local_enabled ? (
                            <Check className="w-4 h-4 text-primary" />
                          ) : (
                            <X className="w-4 h-4 text-text-muted" />
                          )}
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(model.status)}</td>
                      <td className="p-4 text-text-secondary">{getRecommendedAction(model)}</td>
                    </tr>
                  );
                })}
                {filteredModels.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-text-muted">
                      <Terminal className="w-5 h-5 mx-auto mb-2 text-text-muted/40" />
                      当前过滤条件下无模型记录。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 3. Right Panel: Sync Console */}
      <section className="w-[310px] bg-panel border border-border rounded-xl flex flex-col overflow-hidden shrink-0 shadow-2xl">
        <div className="p-4 border-b border-border bg-gradient-to-b from-panel/30 to-panel/10">
          <h2 className="text-text-primary font-bold text-base flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
            同步控制台
          </h2>
          <p className="text-xs text-text-muted mt-1">执行本地渠道与上游模型列表的安全对齐</p>
        </div>

        <div className="flex-1 p-4 space-y-5 overflow-y-auto">
          {/* Target Info */}
          <div className="p-3 bg-divider/25 rounded-xl border border-border/30 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">所选站点:</span>
              <span className="font-semibold text-text-primary truncate max-w-[180px]">
                {sites.find(s => s.id === selectedSiteId)?.name || '未选择'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">目标渠道:</span>
              <span className="font-semibold text-text-primary truncate max-w-[180px]" title={selectedChannel?.name}>
                {selectedChannel?.name || '未选择'}
              </span>
            </div>
          </div>

          {/* Statistics summary */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider">变更统计</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-background/60 p-3 rounded-lg border border-border/30 text-center">
                <p className="text-text-muted text-xs mb-1">新增开启模型</p>
                <p className="font-mono text-base font-black text-success">
                  +{selectedModelNames.length}
                </p>
              </div>
              <div className="bg-background/60 p-3 rounded-lg border border-border/30 text-center">
                <p className="text-text-muted text-xs mb-1">保留旧模型</p>
                <p className="font-mono text-base font-black text-warning">
                  {scannedModels.filter(m => m.status === 'removed').length}
                </p>
              </div>
            </div>
          </div>

          {/* Sync Settings Options */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Settings className="w-3.5 h-3.5" />
              同步设置项
            </h4>
            
            {/* Auto pricing creation option */}
            <label className="flex items-start gap-2.5 p-3 hover:bg-hover-bg/10 rounded-xl border border-border/30 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={autoAddPricing}
                onChange={e => setAutoAddPricing(e.target.checked)}
                className="accent-primary mt-0.5 rounded"
              />
              <div>
                <div className="text-xs font-bold text-text-primary">自动初始化新模型价格</div>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  同步时如果产生新模型，将自动在站点计价表中新建一条 `unset` 价格，防止用户调用导致漏单。
                </p>
              </div>
            </label>

            {/* Safety status card */}
            <div className="flex items-center justify-between p-3 bg-success/5 border border-success/15 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-success">
                <Lock className="w-3.5 h-3.5" />
                <span className="font-bold">安全合并模式</span>
              </div>
              <span className="text-xs text-success/80 font-bold bg-success/10 px-2.5 py-1 rounded-full">默认激活</span>
            </div>

            <div className="p-3 bg-warning/5 border border-warning/15 rounded-xl text-xs text-warning leading-relaxed">
              上游已下线的本地模型只会保留并提示，本工具不会删除或关闭渠道已有模型。
            </div>
          </div>
        </div>

        {/* Execute Button Wrapper */}
        <div className="p-4 border-t border-border bg-gradient-to-t from-panel/30 to-panel/10">
          <button
            onClick={handleSync}
            disabled={isSyncing || !hasScanned || selectedModelNames.length === 0}
            className="w-full bg-gradient-to-r from-primary to-[#2DD4BF] text-background py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.98] disabled:opacity-40 disabled:hover:brightness-100 disabled:pointer-events-none"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                正在下发配置...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                一键同步所选变更
              </>
            )}
          </button>
        </div>
      </section>

      <SyncPriceConfirmModal
        isOpen={confirmModalOpen}
        sourceSiteName={confirmModalData?.sourceSiteName || ''}
        targetSiteName={confirmModalData?.targetSiteName || ''}
        isSelfSync={confirmModalData?.isSelfSync || false}
        modelsToCopy={confirmModalData?.modelsToCopy || []}
        modelsToUnset={confirmModalData?.modelsToUnset || []}
        onConfirm={() => {
          setConfirmModalOpen(false);
          executeSyncAction();
        }}
        onCancel={() => {
          setConfirmModalOpen(false);
          addLocalLog(`[INFO] 用户已取消模型及价格的同步操作。`);
        }}
      />
    </div>
  );
};
