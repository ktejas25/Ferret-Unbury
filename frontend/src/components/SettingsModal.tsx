import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Check,
  RefreshCw,
  Cpu,
  Database,
  Eye,
  Cloud,
  CloudOff,
  Play,
  Pause,
  AlertCircle,
  SlidersHorizontal,
  Server,
  Key,
  Globe,
  HardDrive,
  FileText,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { api } from '../api/client';
import { AppSettings, HealthStatus, SyncStats } from '../types';

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
  const [activeTab, setActiveTab] = useState<'general' | 'cloud' | 'diagnostics'>('general');
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
      setCloudMessage('Connected to Cloudflare Worker endpoint successfully!');
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
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  const embedderDiag = health?.details?.embedder;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-100">Application Settings</h3>
              <p className="text-xs text-slate-400">Manage indexing rules, engine diagnostics, and cloud sync</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-slate-800/80 mb-6 pb-2.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'general'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>General & OCR</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'cloud'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud Synchronization</span>
            {syncStats?.is_connected && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'diagnostics'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Engine Diagnostics</span>
          </button>
        </div>

        {/* Tab 1: General & Indexing */}
        {activeTab === 'general' && (
          <form onSubmit={handleSave} className="space-y-5 text-xs">
            {/* OCR Toggle with Modern iOS/Tailwind Toggle Switch */}
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-center justify-between">
              <div className="pr-4">
                <label className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Optical Character Recognition (OCR)</span>
                </label>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Extract readable text inside PNG, JPG, screenshots, and scanned photos using local Tesseract.
                </p>
              </div>

              {/* Styled Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={ocrEnabled}
                onClick={() => setOcrEnabled(!ocrEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                  ocrEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    ocrEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Ignored Extensions */}
            <div>
              <label className="text-xs font-semibold text-slate-200 block mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Ignored File Extensions</span>
              </label>
              <input
                type="text"
                value={ignoredExts}
                onChange={(e) => setIgnoredExts(e.target.value)}
                placeholder=".tmp, .log, .bak, .pyc, .dll"
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Comma-separated list of file extensions skipped during directory scans.</p>
            </div>

            {/* Max Preview Length */}
            <div>
              <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                Maximum Content Preview Length (characters)
              </label>
              <input
                type="number"
                value={maxPreview}
                onChange={(e) => setMaxPreview(e.target.value)}
                min="100"
                max="5000"
                className="w-full px-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Limits preview text cached in database for fast instant search result cards.</p>
            </div>

            {/* Footer Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {savedSuccess ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium animate-fade-in">
                  <Check className="w-4 h-4" />
                  <span>Settings saved successfully</span>
                </span>
              ) : (
                <span />
              )}

              <div className="flex items-center space-x-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
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
            {/* Status Card */}
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-slate-100">Cloud Sync Status</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border ${
                    syncStats?.is_connected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {syncStats?.is_connected
                    ? syncStats.is_paused
                      ? 'Connected (Paused)'
                      : 'Connected & Active'
                    : 'Disconnected'}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                Optional desktop-to-cloud synchronization. Local files are never deleted or modified. Cloud documents are stored encrypted in Cloudflare R2 and indexed independently in D1 / Vectorize.
              </p>

              {syncStats?.is_connected && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900/90 rounded-xl text-center font-mono border border-slate-800/60">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Synced</span>
                    <span className="text-emerald-400 font-bold text-sm">{syncStats.synced_count}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Pending</span>
                    <span className="text-amber-400 font-bold text-sm">{syncStats.pending_count}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Transferred</span>
                    <span className="text-cyan-400 font-bold text-sm">{formatBytes(syncStats.bytes_synced)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notifications */}
            {cloudMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center justify-between animate-fade-in">
                <span>{cloudMessage}</span>
                <button onClick={() => setCloudMessage(null)}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {cloudError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center justify-between animate-fade-in">
                <span>{cloudError}</span>
                <button onClick={() => setCloudError(null)}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Connection Configuration */}
            <form onSubmit={handleConnectCloud} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Cloudflare Worker API Endpoint</span>
                </label>
                <input
                  type="url"
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  placeholder="https://archaeologist.worker.dev"
                  disabled={syncStats?.is_connected}
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-200 block mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    <span>API Token (Optional)</span>
                  </label>
                  <input
                    type="password"
                    value={cloudApiKey}
                    onChange={(e) => setCloudApiKey(e.target.value)}
                    placeholder="Secret bearer token"
                    disabled={syncStats?.is_connected}
                    className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-200 block mb-1">
                    Workspace Identifier
                  </label>
                  <input
                    type="text"
                    value={cloudWorkspaceId}
                    onChange={(e) => setCloudWorkspaceId(e.target.value)}
                    placeholder="default"
                    disabled={syncStats?.is_connected}
                    className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3">
                {!syncStats?.is_connected ? (
                  <button
                    type="submit"
                    disabled={isConnectingCloud || !cloudUrl.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 active:scale-95"
                  >
                    {isConnectingCloud && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Connect Cloud Workspace</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleDisconnectCloud}
                      className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                    >
                      <CloudOff className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleSyncPause}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                    >
                      {syncStats?.is_paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{syncStats?.is_paused ? 'Resume Sync' : 'Pause Sync'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTriggerSync}
                      disabled={syncStats?.is_paused}
                      className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
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

        {/* Tab 3: System Diagnostics */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-slate-400 font-mono uppercase text-[10px] tracking-wider pb-2 border-b border-slate-800">
                <span>Subsystem</span>
                <span>Status & Runtime</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span className="font-medium">Relational Database</span>
                </span>
                <span className="font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
                  {health?.database || 'connected'} (MySQL 8)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <Cpu className="w-4 h-4 text-violet-400" />
                  <span className="font-medium">Embedding Engine</span>
                </span>
                <span className="font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/25">
                  {health?.model || 'all-MiniLM-L6-v2'}
                  {embedderDiag?.is_fallback ? ' [Fallback]' : ' [Local Torch/ONNX]'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium">Vector ANN Index</span>
                </span>
                <span className="font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                  {health?.vector_index || '384 dimensions'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-300">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium">Background Worker</span>
                </span>
                <span className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25">
                  {health?.worker || 'active'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-start space-x-3 text-xs text-slate-300">
              <ShieldCheck className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-100">100% Privacy Preserved</p>
                <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                  All embeddings, tokens, vectors, and OCR text extraction run exclusively on your machine. No telemetry or file bytes ever leave your system unless you manually connect Cloud Sync.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
