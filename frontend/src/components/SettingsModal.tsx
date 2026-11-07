import React, { useState, useEffect } from 'react';
import {
  X, Settings, Check, RefreshCw, Cpu, Database, Eye, Cloud,
  CloudOff, Play, Pause, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { api } from '../api/client';
import { AppSettings, HealthStatus, SyncStats, SyncSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  health?: HealthStatus;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  health,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'cloud'>('general');
  const [settings, setSettings] = useState<AppSettings>({});
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [ignoredExts, setIgnoredExts] = useState('');
  const [maxPreview, setMaxPreview] = useState('1000');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Cloud Sync State
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudApiKey, setCloudApiKey] = useState('');
  const [cloudWorkspaceId, setCloudWorkspaceId] = useState('default');
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadSyncStatus();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const res = await api.getSettings();
      setSettings(res.settings);
      setOcrEnabled(res.settings.ocr_enabled === 'true');
      setIgnoredExts(res.settings.ignored_extensions || '');
      setMaxPreview(res.settings.max_preview_length || '1000');
      setSavedSuccess(false);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const stats = await api.getSyncStatus();
      setSyncStats(stats);
      if (stats.cloud_url) setCloudUrl(stats.cloud_url);
      if (stats.workspace_id) setCloudWorkspaceId(stats.workspace_id);
    } catch {
      // ignore sync status load failure
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings({
        ocr_enabled: ocrEnabled ? 'true' : 'false',
        ignored_extensions: ignoredExts,
        max_preview_length: maxPreview,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudUrl.trim()) return;

    setIsConnectingCloud(true);
    setCloudError(null);
    setCloudMessage(null);

    try {
      await api.connectCloud({
        cloud_url: cloudUrl.trim(),
        api_key: cloudApiKey.trim() || undefined,
        workspace_id: cloudWorkspaceId.trim() || 'default',
      });
      setCloudMessage('Connected to Cloudflare Worker successfully!');
      loadSyncStatus();
    } catch (err: any) {
      setCloudError(err.message || 'Failed to connect to cloud endpoint.');
    } finally {
      setIsConnectingCloud(false);
    }
  };

  const handleDisconnectCloud = async () => {
    try {
      await api.disconnectCloud();
      setCloudMessage('Disconnected cloud synchronization (local files untouched).');
      loadSyncStatus();
    } catch (err: any) {
      setCloudError(err.message);
    }
  };

  const handleToggleSyncPause = async () => {
    try {
      if (syncStats?.is_paused) {
        await api.resumeSync();
      } else {
        await api.pauseSync();
      }
      loadSyncStatus();
    } catch (err: any) {
      setCloudError(err.message);
    }
  };

  const handleTriggerSync = async () => {
    try {
      await api.triggerSync();
      setCloudMessage('Incremental sync cycle triggered in background.');
      setTimeout(() => loadSyncStatus(), 1500);
    } catch (err: any) {
      setCloudError(err.message);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  const embedderDiag = health?.details?.embedder;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Application Settings</h3>
              <p className="text-xs text-slate-400">Manage indexing rules, model diagnostics, and optional cloud sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 mb-5 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'general'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            General & Indexing
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'cloud'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud Synchronization</span>
            {syncStats?.is_connected && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />
            )}
          </button>
        </div>

        {/* Tab 1: General & Indexing */}
        {activeTab === 'general' && (
          <form onSubmit={handleSave} className="space-y-4">
            {/* OCR Toggle */}
            <div className="p-3.5 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between">
              <div className="pr-4">
                <label className="text-xs font-semibold text-slate-200 block">
                  Optical Character Recognition (OCR)
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Extract text inside PNG, JPG, and screenshot images using local Tesseract OCR engine.
                </p>
              </div>
              <input
                type="checkbox"
                checked={ocrEnabled}
                onChange={(e) => setOcrEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
              />
            </div>

            {/* Ignored Extensions */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Ignored Extensions
              </label>
              <input
                type="text"
                value={ignoredExts}
                onChange={(e) => setIgnoredExts(e.target.value)}
                placeholder=".tmp, .log, .bak, .pyc, .dll"
                className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Comma-separated list of extensions to skip during scans.</p>
            </div>

            {/* Max Preview Length */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Max Content Preview Length (chars)
              </label>
              <input
                type="number"
                value={maxPreview}
                onChange={(e) => setMaxPreview(e.target.value)}
                min="100"
                max="5000"
                className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* System Diagnostics Box */}
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs">
              <p className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider mb-2">Engine Diagnostics</p>
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-slate-500" /> Database</span>
                <span className="font-mono text-[11px] text-emerald-400">{health?.database || 'connected'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-slate-500" /> Embedding Model</span>
                <span className="font-mono text-[11px] text-indigo-400">
                  {health?.model || 'all-MiniLM-L6-v2'}
                  {embedderDiag?.is_fallback ? ' [Fallback Subword]' : ' [Native ST]'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-slate-500" /> Vector Index</span>
                <span className="font-mono text-[11px] text-slate-300">{health?.vector_index || 'ready'}</span>
              </div>
            </div>

            {/* Footer Controls */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              {savedSuccess && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saved successfully
                </span>
              )}
              {!savedSuccess && <span />}

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center space-x-1.5"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 2: Cloud Synchronization */}
        {activeTab === 'cloud' && (
          <div className="space-y-4 text-xs">
            {/* Status Overview Card */}
            <div className="p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-slate-200">Cloud Sync Status</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border ${
                    syncStats?.is_connected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {syncStats?.is_connected ? (syncStats.is_paused ? 'Connected (Paused)' : 'Connected & Active') : 'Disconnected'}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                Optional desktop-to-cloud synchronization. Local files are never deleted or modified.
                Cloud documents are stored in Cloudflare R2 and indexed independently in D1 / Vectorize.
              </p>

              {syncStats?.is_connected && (
                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-900/80 rounded-lg text-center font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Synced</span>
                    <span className="text-emerald-400 font-semibold">{syncStats.synced_count}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Pending</span>
                    <span className="text-amber-400 font-semibold">{syncStats.pending_count}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Transferred</span>
                    <span className="text-cyan-400 font-semibold">{formatBytes(syncStats.bytes_synced)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notifications */}
            {cloudMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center justify-between">
                <span>{cloudMessage}</span>
                <button onClick={() => setCloudMessage(null)}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {cloudError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center justify-between">
                <span>{cloudError}</span>
                <button onClick={() => setCloudError(null)}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Connection Configuration */}
            <form onSubmit={handleConnectCloud} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Cloudflare Worker API Endpoint
                </label>
                <input
                  type="url"
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  placeholder="https://archaeologist.worker.dev"
                  disabled={syncStats?.is_connected}
                  className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    API Key / Token (Optional)
                  </label>
                  <input
                    type="password"
                    value={cloudApiKey}
                    onChange={(e) => setCloudApiKey(e.target.value)}
                    placeholder="Secret bearer token"
                    disabled={syncStats?.is_connected}
                    className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Workspace Identifier
                  </label>
                  <input
                    type="text"
                    value={cloudWorkspaceId}
                    onChange={(e) => setCloudWorkspaceId(e.target.value)}
                    placeholder="default"
                    disabled={syncStats?.is_connected}
                    className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {!syncStats?.is_connected ? (
                  <button
                    type="submit"
                    disabled={isConnectingCloud || !cloudUrl.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center space-x-1.5"
                  >
                    {isConnectingCloud && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Connect Cloud Workspace</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleDisconnectCloud}
                      className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-medium flex items-center space-x-1.5"
                    >
                      <CloudOff className="w-3.5 h-3.5" />
                      <span>Disconnect Cloud</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleSyncPause}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium flex items-center space-x-1.5"
                    >
                      {syncStats?.is_paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{syncStats?.is_paused ? 'Resume Sync' : 'Pause Sync'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTriggerSync}
                      disabled={syncStats?.is_paused}
                      className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-medium flex items-center space-x-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync Now</span>
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
