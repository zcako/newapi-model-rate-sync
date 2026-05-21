import React from 'react';
import { X, CheckCircle2, AlertTriangle, ArrowRight, HelpCircle, ShieldAlert } from 'lucide-react';

interface ModelPriceDetail {
  name: string;
  pricingSummary: string;
}

interface SyncPriceConfirmModalProps {
  isOpen: boolean;
  sourceSiteName: string;
  targetSiteName: string;
  isSelfSync: boolean;
  modelsToCopy: ModelPriceDetail[];
  modelsToUnset: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const SyncPriceConfirmModal: React.FC<SyncPriceConfirmModalProps> = ({
  isOpen,
  sourceSiteName,
  targetSiteName,
  isSelfSync,
  modelsToCopy,
  modelsToUnset,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const totalNewModels = modelsToCopy.length + modelsToUnset.length;

  return (
    <div className="fixed inset-0 bg-background/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-panel border border-border w-full max-w-[650px] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-nav-bg/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-base">价格自动复制与初始化确认</h3>
              <p className="text-xs text-text-muted mt-0.5">
                {isSelfSync ? (
                  <span>
                    源站自同步确认：检测到正在更新源站点本身渠道模型价格
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    源站 <span className="text-primary font-semibold font-mono">{sourceSiteName}</span> 
                    <ArrowRight className="w-3.5 h-3.5 text-text-muted" /> 
                    目标站 <span className="text-success font-semibold font-mono">{targetSiteName}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={onCancel} 
            className="p-1.5 hover:bg-hover-bg rounded-lg text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="p-3 bg-divider/10 border border-border/40 rounded-xl text-xs text-text-secondary leading-relaxed">
            同步开启新模型时，系统将自动检测源站是否有该模型价格配置，并决定如何初始化目标站的全局价格：
          </div>

          {/* Section 1: Copy Pricing */}
          {modelsToCopy.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-success uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  可自动复制价格配置的模型 ({modelsToCopy.length} 个)
                </h4>
                <span className="text-[10px] text-success/80 font-bold bg-success/10 px-2 py-0.5 rounded-full">
                  从源站复制
                </span>
              </div>
              <div className="bg-background/40 border border-success/15 rounded-xl divide-y divide-border/20 max-h-[220px] overflow-y-auto shadow-inner">
                {modelsToCopy.map((item) => (
                  <div key={item.name} className="p-3 flex items-start justify-between gap-4 hover:bg-success/5 transition-colors">
                    <span className="font-mono text-xs font-bold text-text-primary select-all">
                      {item.name}
                    </span>
                    <span className="font-mono text-[11px] text-success text-right break-all max-w-[320px]">
                      {item.pricingSummary}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Default Unset */}
          {modelsToUnset.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-warning uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-warning" />
                  源站无配置，将默认记为“未设置价格”的模型 ({modelsToUnset.length} 个)
                </h4>
                <span className="text-[10px] text-warning/80 font-bold bg-warning/10 px-2 py-0.5 rounded-full">
                  默认未设置
                </span>
              </div>
              <div className="bg-background/40 border border-warning/15 rounded-xl divide-y divide-border/20 max-h-[200px] overflow-y-auto shadow-inner">
                {modelsToUnset.map((name) => (
                  <div key={name} className="p-3 flex items-center justify-between gap-4 hover:bg-warning/5 transition-colors">
                    <span className="font-mono text-xs font-bold text-text-primary select-all">
                      {name}
                    </span>
                    <span className="text-[10px] text-warning font-bold bg-warning/5 border border-warning/10 px-2.5 py-1 rounded">
                      未设置价格 (unset)
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed pl-1">
                提示：为避免用户在目标站上直接调用这些新模型引发漏计费或扣费异常，未设置价格的模型在调用时可能报错或记为免费。建议同步完成后前往工作台补充定价。
              </p>
            </div>
          )}

          {totalNewModels === 0 && (
            <div className="p-6 text-center text-text-muted">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-text-muted/40" />
              未检测到需要同步开启的新模型，其他对齐操作无需修改价格。
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-nav-bg/30 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-background border border-border hover:bg-hover-bg/10 text-text-primary rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
          >
            取消同步
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2.5 bg-gradient-to-r from-primary to-[#2DD4BF] text-background hover:brightness-110 rounded-xl font-black text-sm transition-all shadow-lg active:scale-[0.98]"
          >
            确认并同步
          </button>
        </div>

      </div>
    </div>
  );
};
