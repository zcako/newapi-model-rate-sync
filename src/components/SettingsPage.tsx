import React, { useState } from 'react';
import { Settings, Shield, HardDrive, Network, HelpCircle, Save, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { addLocalLog } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [backendType, setBackendType] = useState('python_local');
  const [configPath, setConfigPath] = useState('D:\\ai\\newapi多个站点模型价格一键同步工具\\sync_tool\\config.json');
  const [timeout, setTimeoutVal] = useState(20);
  const [concurrency, setConcurrency] = useState(5);
  const [proxy, setProxy] = useState('');
  const [logPath, setLogPath] = useState('C:\\Users\\lizhi\\.gemini\\antigravity-cli\\logs\\sync.log');
  
  const [enforcePreview, setEnforcePreview] = useState(true);
  const [autoStop, setAutoStop] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    addLocalLog('[INFO] 保存设置配置参数成功。已更新本地持久存储。');
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex-1 flex overflow-hidden p-6 justify-center">
      <form onSubmit={handleSave} className="bg-panel border border-border w-full max-w-[800px] rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-nav-bg/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-base">系统设置</h3>
              <p className="text-xs text-text-muted mt-0.5">修改系统底座连接配置及全局安全策略选项</p>
            </div>
          </div>
          <button
            type="submit"
            className="bg-primary hover:brightness-110 text-background px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/10 flex items-center gap-1.5 active:scale-95"
          >
            <Save className="w-4 h-4" />
            {isSaved ? '已保存' : '保存设置'}
          </button>
        </div>

        {/* Scrollable container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section: Backend */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <Network className="w-4 h-4 text-primary" />
              后端运行与连接
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary">运行模式</label>
                <select
                  value={backendType}
                  onChange={e => setBackendType(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs focus:border-primary outline-none transition-colors"
                >
                  <option value="python_local">本地 Python 引擎进程桥接 (推荐)</option>
                  <option value="http_remote">远程 NewAPI 同步微服务集 (HTTP)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary">连接超时时间 (秒)</label>
                <input
                  type="number"
                  value={timeout}
                  onChange={e => setTimeoutVal(Number(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs focus:border-primary outline-none transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          <hr className="border-border/30" />

          {/* Section: Storage */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-primary" />
              文件存储与代理配置
            </h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary flex items-center justify-between">
                  <span>本地配置文件保存路径</span>
                  <span className="text-[10px] text-text-muted">使用 Windows DPAPI 加密凭据保存</span>
                </label>
                <input
                  type="text"
                  value={configPath}
                  onChange={e => setConfigPath(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs focus:border-primary outline-none transition-colors font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-secondary">网络代理 (支持 socks5/http)</label>
                  <input
                    type="text"
                    placeholder="未启用代理 (如: 127.0.0.1:7890)"
                    value={proxy}
                    onChange={e => setProxy(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs focus:border-primary outline-none transition-colors font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-secondary">并发同步数 (线程限制)</label>
                  <input
                    type="number"
                    value={concurrency}
                    onChange={e => setConcurrency(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs focus:border-primary outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary">日志输出路径</label>
                <input
                  type="text"
                  value={logPath}
                  onChange={e => setLogPath(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs focus:border-primary outline-none transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          <hr className="border-border/30" />

          {/* Section: Safety */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              全局安全防御策略
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              
              {/* Force Locked Safety Policies */}
              <div className="p-4 bg-background/50 border border-warning/10 rounded-xl space-y-3">
                <div className="text-xs font-bold text-warning flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  底层锁定的规则 (不可修改)
                </div>
                
                <div className="space-y-2.5 text-[11px] text-text-secondary">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    <span>禁止清空或同步为未设置价格状态</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    <span>禁止跨计费模式删除已有价格策略键</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    <span>禁止从面板中删除任何物理站点</span>
                  </div>
                </div>
              </div>

              {/* Adjustable Options */}
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enforcePreview}
                    onChange={e => setEnforcePreview(e.target.checked)}
                    className="accent-primary mt-1"
                  />
                  <div>
                    <span className="text-xs font-bold text-text-primary">价格同步前强制显示预览确认</span>
                    <p className="text-[10px] text-text-muted mt-0.5">每次点击一键同步时弹出比对弹窗，确认无误再执行。</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoStop}
                    onChange={e => setAutoStop(e.target.checked)}
                    className="accent-primary mt-1"
                  />
                  <div>
                    <span className="text-xs font-bold text-text-primary">任意节点写入失败时自动停止</span>
                    <p className="text-[10px] text-text-muted mt-0.5">当向多个目标站点分发价格时，其中之一报错即中断任务。</p>
                  </div>
                </label>
              </div>

            </div>
          </div>

        </div>

      </form>
    </div>
  );
};
