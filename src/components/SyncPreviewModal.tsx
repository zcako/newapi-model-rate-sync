import React, { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw, AlertTriangle, ShieldCheck, HelpCircle, Ban, CheckCircle2, ChevronRight } from 'lucide-react';
import { apiService, SyncPlanItem, SyncResult, Site } from '../services/api';

interface SyncPreviewModalProps {
  sourceSiteId: string;
  targetSiteIds: string[];
  selectedModelNames: string[];
  sites: Site[];
  onClose: () => void;
  onSuccess: () => void;
}

export const SyncPreviewModal: React.FC<SyncPreviewModalProps> = ({
  sourceSiteId,
  targetSiteIds,
  selectedModelNames,
  sites,
  onClose,
  onSuccess,
}) => {
  const [plans, setPlans] = useState<SyncPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceSite = useMemo(() => sites.find(s => s.id === sourceSiteId), [sites, sourceSiteId]);

  // Load preview plan
  useEffect(() => {
    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const previewPlans = await apiService.previewSync(sourceSiteId, targetSiteIds, selectedModelNames);
        setPlans(previewPlans);
      } catch (err: any) {
        setError(err.message || '加载预览失败');
      } finally {
        setIsLoading(false);
      }
    };
    loadPreview();
  }, [sourceSiteId, targetSiteIds, selectedModelNames]);

  // Counts of action types
  const stats = useMemo(() => {
    const counts = { CREATE: 0, UPDATE: 0, NO_CHANGE: 0, SKIP: 0, BLOCKED: 0 };
    plans.forEach(p => {
      if (p.action in counts) {
        counts[p.action]++;
      }
    });
    return counts;
  }, [plans]);

  const handleConfirmSync = async () => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await apiService.executeSync(plans);
      setSyncResult(res);
    } catch (err: any) {
      setError(err.message || '执行同步失败，请检查连接');
    } finally {
      setIsSyncing(false);
    }
  };

  const getSiteName = (id: string) => {
    return sites.find(s => s.id === id)?.name || `站点 ${id}`;
  };

  const getActionBadge = (action: SyncPlanItem['action']) => {
    switch (action) {
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/20 uppercase">
            <CheckCircle2 className="w-3 h-3" /> 新建 (CREATE)
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
            <RefreshCw className="w-3 h-3 animate-spin-slow" /> 更新 (UPDATE)
          </span>
        );
      case 'NO_CHANGE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-text-muted/10 text-text-secondary border border-border uppercase">
            <HelpCircle className="w-3 h-3" /> 无变化
          </span>
        );
      case 'SKIP':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-text-muted/10 text-text-muted border border-border uppercase">
            <Ban className="w-3 h-3" /> 跳过
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-warning/10 text-warning border border-warning/20 uppercase">
            <ShieldCheck className="w-3 h-3" /> 被保护 (BLOCKED)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-panel border border-border w-full max-w-[1000px] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-nav-bg/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-base">同步价格预览</h3>
              <p className="text-xs text-text-muted mt-0.5">
                源站点: <span className="text-primary font-semibold">{sourceSite?.name}</span> ({sourceSite?.url})
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={isSyncing} className="p-1.5 hover:bg-hover-bg rounded-lg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-20 text-text-secondary">
            <RefreshCw className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-medium animate-pulse">正在扫描比对站点价格差异...</p>
          </div>
        ) : syncResult ? (
          /* Sync Finished screen */
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center max-w-[600px] mx-auto space-y-6">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center border border-success/20">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-bold text-text-primary">同步任务执行完成</h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                价格策略已成功分发推送。成功更新/写入了 <span className="text-success font-bold font-mono">{syncResult.success_count}</span> 项，
                自动阻止/失败了 <span className="text-warning font-bold font-mono">{syncResult.fail_count}</span> 项。
              </p>
            </div>
            
            <div className="w-full text-left bg-background/50 border border-border/80 rounded-xl p-4 font-mono text-[11px] leading-relaxed max-h-[200px] overflow-y-auto shadow-inner text-text-secondary">
              {syncResult.logs.map((log, index) => (
                <div key={index} className="py-0.5 border-b border-divider/10 last:border-0 truncate">
                  {log}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="px-6 py-3 bg-primary hover:brightness-110 text-background rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/10"
            >
              关闭并刷新页面
            </button>
          </div>
        ) : (
          /* Normal Preview Panel */
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Stats Dashboard */}
            <div className="p-5 bg-background/30 border-b border-border/50 grid grid-cols-5 divide-x divide-border/40 text-center shrink-0">
              <div className="px-4">
                <div className="text-[10px] uppercase font-bold text-text-muted">新建价格 (CREATE)</div>
                <div className="text-2xl font-black text-success font-mono mt-1">{stats.CREATE}</div>
              </div>
              <div className="px-4">
                <div className="text-[10px] uppercase font-bold text-text-muted">更新价格 (UPDATE)</div>
                <div className="text-2xl font-black text-primary font-mono mt-1">{stats.UPDATE}</div>
              </div>
              <div className="px-4">
                <div className="text-[10px] uppercase font-bold text-text-muted">无变化 (NO_CHANGE)</div>
                <div className="text-2xl font-black text-text-secondary font-mono mt-1">{stats.NO_CHANGE}</div>
              </div>
              <div className="px-4">
                <div className="text-[10px] uppercase font-bold text-text-muted">跳过 (SKIP)</div>
                <div className="text-2xl font-black text-text-muted font-mono mt-1">{stats.SKIP}</div>
              </div>
              <div className="px-4">
                <div className="text-[10px] uppercase font-bold text-text-muted">被保护 (BLOCKED)</div>
                <div className="text-2xl font-black text-warning font-mono mt-1">{stats.BLOCKED}</div>
              </div>
            </div>

            {error && (
              <div className="m-4 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* List Details Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-nav-bg/95 backdrop-blur-md z-10 border-b border-border">
                  <tr className="text-text-muted font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4 w-48">模型名称</th>
                    <th className="p-4 w-40">目标站点</th>
                    <th className="p-4">当前价格摘要 (目标站)</th>
                    <th className="p-4"><div className="flex items-center gap-1.5">同步后价格摘要 <ChevronRight className="w-3.5 h-3.5 text-primary" /></div></th>
                    <th className="p-4 w-40">操作类型</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {plans.map((plan, index) => (
                    <tr key={index} className={`hover:bg-hover-bg/10 transition-colors ${
                      plan.action === 'BLOCKED' ? 'bg-warning/5' : plan.action === 'NO_CHANGE' ? 'opacity-60' : ''
                    }`}>
                      <td className="p-4 font-medium text-text-primary font-mono select-all">{plan.model_name}</td>
                      <td className="p-4 text-text-secondary truncate">{getSiteName(plan.target_site_id)}</td>
                      <td className="p-4 font-mono text-[11px] text-text-muted truncate" title={plan.target_price_summary}>
                        {plan.target_price_summary}
                      </td>
                      <td className="p-4 font-mono text-[11px] text-text-primary font-bold truncate" title={plan.source_price_summary}>
                        {plan.source_price_summary}
                      </td>
                      <td className="p-4">{getActionBadge(plan.action)}</td>
                    </tr>
                  ))}
                  {plans.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-text-muted">
                        未匹配到待同步的比对项目。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Operations footer */}
            <div className="p-4 border-t border-border bg-nav-bg/30 flex items-center justify-between shrink-0">
              <div className="text-xs text-text-muted flex items-center gap-1.5 max-w-[500px]">
                <ShieldCheck className="w-4 h-4 text-warning" />
                <span>
                  本工具默认启用安全模式：禁止任何删除、清空以及可能导致目标站旧配置损毁的操作。
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={isSyncing}
                  className="px-5 py-2.5 hover:bg-hover-bg rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmSync}
                  disabled={isSyncing || plans.length === 0 || stats.CREATE + stats.UPDATE === 0}
                  className="px-6 py-2.5 bg-primary hover:brightness-110 text-background disabled:opacity-40 disabled:hover:brightness-100 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-primary/10 active:scale-95"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      正在同步写入...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      确认同步 ({stats.CREATE + stats.UPDATE} 项变更)
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
