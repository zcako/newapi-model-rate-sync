import React, { useState, useEffect } from 'react';
import {
  Server,
  RefreshCw,
  Settings as SettingsIcon,
  Terminal,
  Play,
  Download,
} from 'lucide-react';
import { apiService, Site } from './services/api';

// Components
import { PricingWorkbench } from './components/PricingWorkbench';
import { ChannelSyncPage } from './components/ChannelSyncPage';
import { SettingsPage } from './components/SettingsPage';
import { SiteModal } from './components/SiteModal';
import { SyncPreviewModal } from './components/SyncPreviewModal';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('pricing');
  const [sites, setSites] = useState<Site[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState('全部日志');
  const [autoScroll, setAutoScroll] = useState(true);

  // Modal controls
  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [isSyncPreviewOpen, setIsSyncPreviewOpen] = useState(false);

  // Sync parameters bubbled from workbench
  const [syncSourceSiteId, setSyncSourceSiteId] = useState('1');
  const [syncTargetSiteIds, setSyncTargetSiteIds] = useState<string[]>([]);
  const [syncSelectedModelNames, setSyncSelectedModelNames] = useState<string[]>([]);

  // Load sites
  const loadSites = async () => {
    try {
      const data = await apiService.listSites();
      setSites(data);
    } catch (err) {
      console.error('Failed to load sites:', err);
    }
  };

  // Load initial logs and subscribe to log stream
  useEffect(() => {
    loadSites();
    
    // Initial logs load
    apiService.getSyncLogs().then(setLogs);

    // Subscribe to new logs
    const unsubscribe = apiService.subscribeLogs((newLog) => {
      setLogs((prev) => [...prev, newLog]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Filter logs based on severity level
  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (logFilter === '全部日志') return true;
      if (logFilter === '信息') return log.includes('[INFO]');
      if (logFilter === '成功') return log.includes('[SUCCESS]');
      if (logFilter === '警告') return log.includes('[WARN]');
      if (logFilter === '错误') return log.includes('[ERROR]');
      return true;
    });
  }, [logs, logFilter]);

  // Handle open site modal
  const handleOpenSiteModal = (site: Site | null) => {
    setEditingSite(site);
    setIsSiteModalOpen(true);
  };

  const handleOpenSyncPreview = (sourceId: string, targetIds: string[], modelNames: string[]) => {
    setSyncSourceSiteId(sourceId);
    setSyncTargetSiteIds(targetIds);
    setSyncSelectedModelNames(modelNames);
    setIsSyncPreviewOpen(true);
  };

  const handleSyncClick = () => {
    setIsSyncPreviewOpen(true);
  };

  const handleExportLogs = () => {
    const text = logs.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `newapi_sync_${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const renderLogLine = (log: string, index: number) => {
    // Match "[2026-05-21 21:14:58] [INFO] message"
    const timestampMatch = log.match(/^\[(.*?)\]/);
    const timestamp = timestampMatch ? timestampMatch[0] : '';
    let content = log.substring(timestamp.length).trim();
    
    let level = 'INFO';
    let levelColor = 'text-primary';
    
    if (content.startsWith('[SUCCESS]')) {
      level = 'SUCCESS';
      levelColor = 'text-success';
      content = content.substring(9).trim();
    } else if (content.startsWith('[WARN]')) {
      level = 'WARN';
      levelColor = 'text-warning';
      content = content.substring(6).trim();
    } else if (content.startsWith('[ERROR]')) {
      level = 'ERROR';
      levelColor = 'text-error';
      content = content.substring(7).trim();
    } else if (content.startsWith('[INFO]')) {
      level = 'INFO';
      levelColor = 'text-[#38BDF8]';
      content = content.substring(6).trim();
    }

    return (
      <div key={index} className="flex gap-3 mb-1 font-mono text-xs leading-relaxed py-0.5 border-b border-border/10 last:border-0 hover:bg-hover-bg/10 px-1 rounded transition-all">
        {timestamp && <span className="text-text-muted shrink-0 select-none">{timestamp}</span>}
        <span className={`${levelColor} font-bold shrink-0 select-none`}>[{level}]</span>
        <span className="text-text-secondary select-all">{content}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background text-text-primary overflow-hidden font-sans">
      
      {/* 1. Header Navigation */}
      <header className="h-[60px] bg-nav-bg border-b border-border flex items-center px-5 gap-8 shrink-0">
        <div className="text-base font-bold flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center border border-primary/30">
            <Server className="w-4.5 h-4.5 text-primary" />
          </div>
          <span>NewAPI 多站点价格一键同步工具</span>
        </div>

        <nav className="flex h-full">
          {[
            { id: 'pricing', label: '站点与模型价格' },
            { id: 'channels', label: '渠道模型同步' },
            { id: 'logs', label: '同步日志' },
            { id: 'settings', label: '系统设置' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 h-full flex items-center transition-all border-b-2 font-bold text-xs relative ${
                activeTab === tab.id
                  ? 'text-primary border-primary bg-hover-bg/30'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-hover-bg/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 text-success text-xs bg-success/10 px-3 py-1.5 rounded-full border border-success/15 font-bold">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>后端状态: 在线</span>
          </div>
        </div>
      </header>

      {/* 2. Main Page Content Routing */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'pricing' && (
          <PricingWorkbench
            sites={sites}
            onRefreshSites={loadSites}
            onOpenSiteModal={handleOpenSiteModal}
            onOpenSyncPreview={handleOpenSyncPreview}
            onChangeTargetSites={setSyncTargetSiteIds}
            onChangeSelectedModels={setSyncSelectedModelNames}
            onSourceSiteChange={setSyncSourceSiteId}
          />
        )}
        
        {activeTab === 'channels' && (
          <ChannelSyncPage
            sites={sites}
            sourceSiteId={syncSourceSiteId}
            onSwitchTab={setActiveTab}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPage />
        )}

        {activeTab === 'logs' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="bg-panel border border-border rounded-2xl flex-1 flex flex-col overflow-hidden shadow-xl">
              <div className="p-4 border-b border-border flex items-center justify-between bg-nav-bg/30">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  <span className="font-bold text-text-primary text-sm">系统历史运行日志档案</span>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="bg-background border border-border text-xs font-bold uppercase rounded-full px-3 py-1.5 outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option>全部日志</option>
                    <option>信息</option>
                    <option>成功</option>
                    <option>警告</option>
                    <option>错误</option>
                  </select>
                  <button
                    onClick={handleExportLogs}
                    className="text-xs font-bold uppercase bg-background border border-border rounded-full px-3 py-1.5 hover:bg-hover-bg text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> 导出文件
                  </button>
                  <button
                    onClick={handleClearLogs}
                    className="text-xs font-bold uppercase text-error hover:text-error/80 hover:bg-error/5 border border-error/20 rounded-full px-3 py-1.5 transition-all"
                  >
                    清空控制台
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-[#090D14] m-4 rounded-xl p-4 overflow-y-auto font-mono text-xs leading-relaxed shadow-inner">
                {filteredLogs.map((log, index) => renderLogLine(log, index))}
                {filteredLogs.length === 0 && (
                  <div className="h-full flex items-center justify-center text-text-muted text-xs">
                    控制台无匹配的日志记录。
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer: Global Terminal (only shown on pricing workbench/channel tab) */}
      {activeTab === 'pricing' && (
        <footer className="h-[200px] bg-panel border-t border-border flex shrink-0 mx-4 mb-4 rounded-2xl overflow-hidden shadow-2xl">
          {/* Logs viewer */}
          <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
            <div className="p-3 px-5 border-b border-divider bg-nav-bg/30 flex items-center justify-between shrink-0">
              <div className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" /> 系统日志与同步控制台
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="bg-background border border-border text-xs font-bold uppercase rounded-full px-3 py-1 outline-none focus:border-primary transition-colors cursor-pointer"
                >
                  <option>全部日志</option>
                  <option>信息</option>
                  <option>成功</option>
                  <option>警告</option>
                  <option>错误</option>
                </select>
                <button
                  onClick={handleClearLogs}
                  className="text-xs font-bold uppercase text-text-secondary hover:text-text-primary transition-colors"
                >
                  清屏
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-[#0A0F16] m-3 rounded-xl p-3 overflow-y-auto font-mono text-xs leading-relaxed shadow-inner">
              {filteredLogs.map((log, index) => renderLogLine(log, index))}
            </div>
          </div>
          
          {/* Large trigger sync button */}
          <div className="w-[360px] flex items-center justify-center p-6 bg-nav-bg/20 shrink-0">
             <div className="relative group w-full">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-[#2DD4BF] rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
                <button
                  onClick={handleSyncClick}
                  disabled={syncSelectedModelNames.length === 0 || syncTargetSiteIds.length === 0}
                  className="relative w-full h-[90px] bg-gradient-to-br from-primary to-[#2DD4BF] hover:from-[#7DD3FC] hover:to-[#5EEAD4] text-background disabled:opacity-45 disabled:hover:from-primary disabled:hover:to-[#2DD4BF] rounded-2xl font-black text-lg flex flex-col items-center justify-center gap-0.5 transition-all shadow-2xl active:scale-[0.98] border border-white/10 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-2">
                    <Play className="w-5 h-5 fill-current" />
                    <span>一键同步所选价格</span>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-[0.15em] opacity-80 mt-1 font-mono">
                    同步 {syncSelectedModelNames.length} 个模型至 {syncTargetSiteIds.length} 个目标站
                  </span>
                </button>
             </div>
          </div>
        </footer>
      )}

      {/* 4. Overlay Modals */}
      {isSiteModalOpen && (
        <SiteModal
          site={editingSite}
          onClose={() => setIsSiteModalOpen(false)}
          onSave={loadSites}
        />
      )}

      {isSyncOpenModalHelper(isSyncPreviewOpen, syncSourceSiteId, syncTargetSiteIds, syncSelectedModelNames) && (
        <SyncPreviewModal
          sourceSiteId={syncSourceSiteId}
          targetSiteIds={syncTargetSiteIds}
          selectedModelNames={syncSelectedModelNames}
          sites={sites}
          onClose={() => setIsSyncPreviewOpen(false)}
          onSuccess={loadSites}
        />
      )}

    </div>
  );
};

// Helper function to prevent rendering with invalid target selection
function isSyncOpenModalHelper(open: boolean, source: string, targets: string[], models: string[]) {
  return open && source && targets.length > 0 && models.length > 0;
}

export default App;
