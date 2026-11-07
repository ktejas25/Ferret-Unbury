import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cloud, CheckCircle2, AlertTriangle, Pause, Play, RotateCcw,
  Plus, Trash2, Folder, HardDrive, ShieldCheck, ArrowRight, RefreshCw
} from 'lucide-react';
import { api } from '../api/client';
import { SyncStats, SyncSettings, SyncItem, SyncHistoryEntry } from '../types';

export const CloudSyncPage: React.FC = () => {
  const [cloudUrl, setCloudUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [workspaceId, setWorkspaceId] = useState('default_workspace');
  const [newFolderPath, setNewFolderPath] = useState('');

  const { data: stats, refetch: refetchStats } = useQuery<SyncStats>({
    queryKey: ['syncStatsPage'],
    queryFn: () => api.getSyncStatus(),
    refetchInterval: 5000,
  });

  const { data: settings, refetch: refetchSettings } = useQuery<SyncSettings>({
    queryKey: ['syncSettingsPage'],
    queryFn: () => api.getSyncSettings(),
  });

  const { data: syncItems = [], refetch: refetchItems } = useQuery<SyncItem[]>({
    queryKey: ['syncItemsPage'],
    queryFn: () => api.getSyncItems(50),
    refetchInterval: 5000,
  });

  const { data: syncHistory = [] } = useQuery<SyncHistoryEntry[]>({
    queryKey: ['syncHistoryPage'],
    queryFn: () => api.getSyncHistory(20),
  });

  const isConnected = stats?.is_connected ?? false;
  const isPaused = stats?.is_paused ?? false;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudUrl.trim()) return;

    try {
      await api.connectCloud({
        cloud_url: cloudUrl.trim(),
        api_key: apiKey.trim() || undefined,
        workspace_id: workspaceId.trim() || undefined,
      });
      refetchStats();
      refetchSettings();
    } catch (err: any) {
      alert(err.message || 'Connection failed');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect from Cloud? Your local files will remain 100% intact.')) return;
    await api.disconnectCloud();
    refetchStats();
    refetchSettings();
  };

  const handleTogglePause = async () => {
    if (isPaused) {
      await api.resumeSync();
    } else {
      await api.pauseSync();
    }
    refetchStats();
  };

  const handleTriggerSync = async () => {
    await api.triggerSync();
    refetchStats();
    refetchItems();
  };

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderPath.trim()) return;
    await api.addSyncFolder(newFolderPath.trim());
    setNewFolderPath('');
    refetchSettings();
  };

  const handleRemoveFolder = async (folderPath: string) => {
    await api.removeSyncFolder(folderPath);
    refetchSettings();
  };

  const handleRetryFailed = async () => {
    await api.retryFailedSync();
    refetchStats();
    refetchItems();
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Cloud className="w-6 h-6 text-violet-400" />
            Cloud Synchronization Subsystem
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Optional, zero-knowledge synchronization to Cloudflare R2 and Vectorize edge index.
          </p>
        </div>

        {isConnected && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerSync}
              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition shadow-lg shadow-violet-950/40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Now</span>
            </button>
            <button
              onClick={handleTogglePause}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition ${
                isPaused
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                  : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'Resume Sync' : 'Pause Sync'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Connection Status Banner */}
      {!isConnected ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Connect to Cloudflare Workspace</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                Synchronization is disabled by default. Connect your Cloudflare Worker endpoint to enable selective folder backups, multi-device search, and edge document intelligence.
              </p>
            </div>
          </div>

          <form onSubmit={handleConnect} className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Cloud Worker Endpoint *</label>
              <input
                type="url"
                required
                value={cloudUrl}
                onChange={(e) => setCloudUrl(e.target.value)}
                placeholder="https://file-archaeologist.workers.dev"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">API Key / Bearer Token</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Optional auth token..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Workspace ID</label>
              <input
                type="text"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(e.target.value)}
                placeholder="default_workspace"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
              />
            </div>
            <div className="md:col-span-3 flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-violet-950/40 transition"
              >
                Connect Cloud Workspace
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Connected State Metrics */
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">Synced Documents</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">{stats?.synced_count ?? 0}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">Pending Upload</span>
              <span className="text-xl font-bold text-violet-400 font-mono">{stats?.pending_count ?? 0}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">Cloud Data Transferred</span>
              <span className="text-xl font-bold text-indigo-400 font-mono">{formatBytes(stats?.bytes_synced ?? 0)}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">Sync Failures</span>
              <div className="flex items-center justify-between">
                <span className={`text-xl font-bold font-mono ${(stats?.failed_count ?? 0) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {stats?.failed_count ?? 0}
                </span>
                {(stats?.failed_count ?? 0) > 0 && (
                  <button
                    onClick={handleRetryFailed}
                    className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                  >
                    Retry All
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sync Folder Selection */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                  Synchronized Folders
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Only documents residing in these directories will be uploaded.</p>
              </div>

              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 text-xs text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-800/40 rounded-lg transition"
              >
                Disconnect Cloud
              </button>
            </div>

            {/* Add Sync Folder Form */}
            <form onSubmit={handleAddFolder} className="flex gap-2">
              <input
                type="text"
                required
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                placeholder="Enter absolute directory path to synchronize..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium shrink-0 flex items-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Folder</span>
              </button>
            </form>

            <div className="space-y-2">
              {settings?.sync_folders && settings.sync_folders.length > 0 ? (
                settings.sync_folders.map((folderPath) => (
                  <div
                    key={folderPath}
                    className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate font-mono text-slate-300">
                      <Folder className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="truncate">{folderPath}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveFolder(folderPath)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                      title="Remove folder from sync"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  No folders selected for cloud sync yet. Add a folder above to start syncing.
                </div>
              )}
            </div>
          </div>

          {/* Tracked Sync Items */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Live Document Synchronization State
            </h2>

            <div className="divide-y divide-slate-800/40 max-h-[360px] overflow-y-auto">
              {syncItems.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="truncate pr-4">
                    <span className="font-medium text-slate-200 block truncate">{item.filename}</span>
                    <span className="text-[10px] font-mono text-slate-500 truncate block">{item.local_path}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-slate-500">{formatBytes(item.size_bytes)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold ${
                      item.status === 'synced'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                        : item.status === 'failed'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                        : 'bg-violet-950/80 text-violet-300 border border-violet-800/40'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}

              {syncItems.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">No items tracked for sync.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

