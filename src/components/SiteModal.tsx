import React, { useState, useEffect } from 'react';
import { X, Server, KeyRound, Lock, User, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiService, Site } from '../services/api';

interface SiteModalProps {
  site: Site | null; // null for Add, Site object for Edit
  onClose: () => void;
  onSave: () => void;
}

export const SiteModal: React.FC<SiteModalProps> = ({ site, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authMethod, setAuthMethod] = useState<'access_token' | 'password'>('access_token');
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize if editing
  useEffect(() => {
    if (site) {
      setName(site.name || '');
      setUrl(site.url || '');
      setAuthMethod(site.auth_method || 'access_token');
      setToken(site.token || '');
      setUserId(site.user_id || '');
      setUsername(site.username || '');
      setPassword(site.password || '');
    }
  }, [site]);

  const handleTestConnection = async () => {
    if (!url.trim()) {
      setError('请输入 API 地址 (Base URL)');
      return;
    }
    setError(null);
    setIsTesting(true);
    setTestResult(null);

    try {
      // Temporarily save site configurations to test
      const tempSiteData = {
        name: name || '测试站点',
        url,
        auth_method: authMethod,
        token,
        user_id: userId,
        username,
        password,
        auth_type: 'admin' as const,
      };

      let resultSite: Site;
      if (site) {
        await apiService.editSite(site.id, tempSiteData);
        resultSite = { ...site, ...tempSiteData };
      } else {
        // Create a temporary site configuration or use edit with custom endpoint.
        // For testing we will just call editSite / testSite directly after a quick save or local test
        // To avoid polluting, we edit or add. Let's add it temporarily or test directly
        // Let's call apiService.testSite after updating the site configuration.
        // Wait, for temporary add we can just do it. Let's create it, then test.
        const created = await apiService.addSite(tempSiteData);
        const testRes = await apiService.testSite(created.id);
        setTestResult({ success: testRes.success, message: testRes.message });
        setIsTesting(false);
        return;
      }

      const testRes = await apiService.testSite(resultSite.id);
      setTestResult({ success: testRes.success, message: testRes.message });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || '测试连接发生未知错误' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入站点名称');
      return;
    }
    if (!url.trim()) {
      setError('请输入 API 地址');
      return;
    }
    if (authMethod === 'access_token') {
      if (!token.trim()) {
        setError('请输入 Access Token');
        return;
      }
      if (!userId.trim()) {
        setError('请输入 New-Api-User ID');
        return;
      }
    } else {
      if (!username.trim()) {
        setError('请输入用户名');
        return;
      }
      if (!password.trim()) {
        setError('请输入密码');
        return;
      }
    }

    setError(null);
    try {
      const siteData = {
        name,
        url,
        auth_method: authMethod,
        token,
        user_id: userId,
        username,
        password,
        auth_type: 'admin' as const,
      };

      if (site) {
        await apiService.editSite(site.id, siteData);
      } else {
        await apiService.addSite(siteData);
      }
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || '保存失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-panel border border-border w-full max-w-[500px] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-nav-bg/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-base">{site ? '编辑站点配置' : '添加 NewAPI 站点'}</h3>
              <p className="text-xs text-text-muted mt-0.5">{site ? '修改现有站点的连接与凭据信息' : '配置一个新的站点以进行价格同步'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-hover-bg rounded-lg text-text-secondary hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-error/10 border border-error/20 rounded-xl text-error text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Site Name */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">站点名称</label>
            <input
              type="text"
              placeholder="例如: 官方生产主站"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-all placeholder:text-text-muted/40"
            />
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">API 地址 (Base URL)</label>
            <input
              type="url"
              placeholder="例如: https://api.yourdomain.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-all placeholder:text-text-muted/40 font-mono"
            />
          </div>

          {/* Auth Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">认证方式</label>
            <div className="grid grid-cols-2 gap-2 bg-background p-1 rounded-xl border border-border/50">
              <button
                type="button"
                onClick={() => setAuthMethod('access_token')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  authMethod === 'access_token'
                    ? 'bg-panel text-primary shadow border border-border/40'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" /> Access Token 模式
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('password')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  authMethod === 'password'
                    ? 'bg-panel text-primary shadow border border-border/40'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Lock className="w-3.5 h-3.5" /> 密码登录模式
              </button>
            </div>
          </div>

          {/* Dynamic Fields */}
          {authMethod === 'access_token' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Access Token</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="请输入以 Bearer 或 sk- 开头的凭据"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:border-primary outline-none transition-all placeholder:text-text-muted/40 font-mono"
                  />
                  <KeyRound className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">New-Api-User ID</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="管理接口要求的用户 ID (例如: 1)"
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:border-primary outline-none transition-all placeholder:text-text-muted/40 font-mono"
                  />
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">用户名</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="管理员用户名"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:border-primary outline-none transition-all placeholder:text-text-muted/40"
                  />
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">密码</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="管理员密码"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl pl-4 pr-10 py-3 text-sm focus:border-primary outline-none transition-all placeholder:text-text-muted/40 font-mono"
                  />
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
                </div>
              </div>
            </div>
          )}

          {/* Test connection result banner */}
          {testResult && (
            <div className={`p-4 border rounded-xl text-xs flex gap-3 animate-in fade-in duration-200 ${
              testResult.success
                ? 'bg-success/5 border-success/20 text-success'
                : 'bg-error/5 border-error/20 text-error'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <div>
                <div className="font-bold">{testResult.success ? '连接成功' : '连接失败'}</div>
                <div className="opacity-90 mt-1">{testResult.message}</div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-nav-bg/30 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-4 py-2.5 border border-border rounded-xl text-xs font-bold hover:bg-hover-bg transition-colors flex items-center gap-2 text-text-secondary hover:text-text-primary disabled:opacity-50"
          >
            <Activity className={`w-4 h-4 ${isTesting ? 'animate-spin text-primary' : ''}`} />
            {isTesting ? '测试中...' : '测试连接'}
          </button>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 hover:bg-hover-bg rounded-xl text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 bg-primary hover:brightness-110 text-background rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary/10 active:scale-95"
            >
              保存配置
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
