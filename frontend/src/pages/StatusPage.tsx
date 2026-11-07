import React, { useState } from 'react';
import {
  FolderTree,
  Plus,
  Trash2,
  RefreshCw,
  Pause,
  Play,
  AlertTriangle,
  HardDrive,
  Cpu,
  FileCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FolderPlus,
  FolderOpen,
  Folder,
  Layers,
  Activity,
  Zap,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  X
} from 'lucide-react';
import { api } from '../api/client';
import { IndexStatus, FolderItem } from '../types';

interface StatusPageProps {
  status?: IndexStatus;
  folders: FolderItem[];
  refetchStatus: () => void;
  refetchFolders: () => void;
}

export const StatusPage: React.FC<StatusPageProps> = ({
  status,
  folders,
  refetchStatus,
  refetchFolders,
}) => {
  const [newFolderPath, setNewFolderPath] = useState('');
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [showRebuildModal, setShowRebuildModal] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderPath.trim()) return;

    setIsAddingFolder(true);
    setAddError(null);

    try {
      await api.addFolder(newFolderPath.trim());
      setNewFolderPath('');
      setActionMessage('Folder added and background discovery initiated successfully');
      setTimeout(() => setActionMessage(null), 3500);
      refetchFolders();
      refetchStatus();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add folder.');
    } finally {
      setIsAddingFolder(false);
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      await api.removeFolder(folderToDelete.id);
      setActionMessage(`Folder ${folderToDelete.path} removed from monitoring`);
      setTimeout(() => setActionMessage(null), 3500);
      setFolderToDelete(null);
      refetchFolders();
      refetchStatus();
    } catch (err: any) {
      setActionMessage(`Failed to remove folder: ${err.message}`);
      setFolderToDelete(null);
    }
  };

  const isWorkerPaused = Boolean(status?.is_paused);

  const handleToggleWorkerPause = async () => {
    try {
      if (isWorkerPaused) {
        await api.resumeWorker();
        setActionMessage('Indexing worker resumed');
      } else {
        await api.pauseWorker();
        setActionMessage('Indexing worker paused');
      }
      setTimeout(() => setActionMessage(null), 3500);
      refetchStatus();
    } catch (err: any) {
      setActionMessage(`Worker action error: ${err.message}`);
    }
  };

  const handleConfirmRebuild = async () => {
    setIsRebuilding(true);
    try {
      await api.rebuildIndex(true);
      setShowRebuildModal(false);
      setActionMessage('Full vector index rebuild initiated in background');
      setTimeout(() => setActionMessage(null), 4000);
      refetchStatus();
      refetchFolders();
    } catch (err: any) {
      setActionMessage(`Rebuild failed: ${err.message}`);
    } finally {
      setIsRebuilding(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Scanning</span>
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <Pause className="w-3.5 h-3.5" />
            <span>Paused</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25">
            <XCircle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending scan</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Action Notification Toast */}
      {actionMessage && (
        <div className="mb-6 px-4 py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-indigo-200 text-xs font-medium flex items-center justify-between shadow-lg shadow-indigo-500/10 animate-fade-in">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="p-1 text-indigo-400 hover:text-white rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Worker Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <FolderTree className="w-6 h-6 text-indigo-400" />
            <span>Index & Folder Management</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl">
            Configure local folders, inspect queue diagnostics, and orchestrate semantic indexing.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Worker Status Pill */}
          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium border flex items-center gap-2 shadow-sm ${
              isWorkerPaused
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : status?.is_indexing
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isWorkerPaused
                  ? 'bg-amber-400'
                  : status?.is_indexing
                  ? 'bg-indigo-400 animate-ping'
                  : 'bg-emerald-400'
              }`}
            />
            <span>
              Worker: {isWorkerPaused ? 'Paused' : status?.is_indexing ? 'Indexing' : 'Idle'}
            </span>
          </div>

          <button
            onClick={() => {
              refetchStatus();
              refetchFolders();
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-medium transition-all shadow-sm active:scale-95"
            title="Refresh statistics and folder statuses"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleToggleWorkerPause}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 ${
              isWorkerPaused
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 shadow-emerald-500/10'
                : 'bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 shadow-amber-500/10'
            }`}
          >
            {isWorkerPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isWorkerPaused ? 'Resume Indexing' : 'Pause Indexing'}</span>
          </button>
        </div>
      </div>

      {/* Active Indexing Banner */}
      {status?.is_indexing && (
        <div className="p-5 mb-8 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-indigo-500/15 border border-indigo-500/30 shadow-xl shadow-indigo-500/5 animate-fade-in">
          <div className="flex items-center justify-between text-xs sm:text-sm text-indigo-200 font-medium mb-2.5">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Active Task: {status.current_task || 'Indexing queued files...'}</span>
            </span>
            <span className="font-mono text-indigo-300 font-semibold">
              {status.indexed_files} / {status.total_files} ({status.total_files ? Math.round((status.indexed_files / status.total_files) * 100) : 0}%)
            </span>
          </div>
          <div className="w-full bg-slate-900/80 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
            <div
              className="bg-gradient-to-r from-indigo-500 to-violet-500 h-2.5 rounded-full transition-all duration-300 shadow-sm"
              style={{
                width: `${status.total_files ? Math.min(100, Math.round((status.indexed_files / status.total_files) * 100)) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Metric 1 */}
        <div className="p-5 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 rounded-2xl transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Indexed Files</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tracking-tight">
            {status?.indexed_files ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-mono">
            {status?.total_files ?? 0} discovered on disk
          </p>
        </div>

        {/* Metric 2 */}
        <div className="p-5 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 rounded-2xl transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Pending Queue</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tracking-tight">
            {status?.pending_files ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-mono">
            {status?.processing_files ?? 0} currently processing
          </p>
        </div>

        {/* Metric 3 */}
        <div className="p-5 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 rounded-2xl transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Vector Index</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tracking-tight">
            {status?.vector_count ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-mono">
            all-MiniLM-L6-v2 embeddings
          </p>
        </div>

        {/* Metric 4 */}
        <div className="p-5 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 rounded-2xl transition-all shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Index Footprint</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tracking-tight">
            {formatBytes(status?.index_size_bytes ?? 0)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-mono">
            {status?.skipped_files ?? 0} skipped • {status?.failed_files ?? 0} errors
          </p>
        </div>
      </div>

      {/* Add Folder Section */}
      <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl mb-8 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-indigo-400" />
            <span>Add Monitored Folder</span>
          </h3>
        </div>

        <p className="text-xs text-slate-400 mb-4 max-w-xl leading-relaxed">
          Specify any folder path on your computer. File Archaeologist will recursively discover, monitor changes, and extract text and OCR semantically.
        </p>

        <form onSubmit={handleAddFolder} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Folder className="w-4 h-4" />
            </div>
            <input
              id="add-folder-input"
              type="text"
              value={newFolderPath}
              onChange={(e) => setNewFolderPath(e.target.value)}
              placeholder="e.g. C:\Users\YourName\Documents or D:\Projects\Notes"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>

          <button
            id="add-folder-submit"
            type="submit"
            disabled={isAddingFolder || !newFolderPath.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-indigo-600/25 flex items-center justify-center space-x-1.5 active:scale-95"
          >
            {isAddingFolder ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>Add Folder</span>
          </button>
        </form>

        {addError && (
          <div className="mt-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-300 flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{addError}</span>
          </div>
        )}
      </div>

      {/* Monitored Folders List */}
      <div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl mb-8 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            <span>Active Monitored Folders ({folders.length})</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {folders.reduce((acc, f) => acc + (f.file_count || 0), 0)} total files
          </span>
        </div>

        {folders.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs sm:text-sm">
            <FolderTree className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-slate-300 font-medium">No monitored folders yet</p>
            <p className="text-slate-500 text-xs mt-1">Add a folder above to start indexing and discovering your files.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {folders.map((f) => (
              <div
                key={f.id}
                className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 group"
              >
                <div className="min-w-0">
                  <div className="flex items-center space-x-2.5">
                    <Folder className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <p className="text-xs sm:text-sm font-mono font-medium text-slate-100 truncate group-hover:text-indigo-200 transition-colors">
                      {f.path}
                    </p>
                    {getStatusBadge(f.scan_status)}
                  </div>
                  <div className="flex flex-wrap items-center space-x-3 text-[11px] text-slate-400 mt-1.5 font-mono">
                    <span className="text-slate-300 font-medium">{f.file_count} files</span>
                    <span>•</span>
                    <span>
                      {f.last_scanned_at
                        ? `Last scanned ${new Date(f.last_scanned_at).toLocaleTimeString()}`
                        : 'Initial scan pending'}
                    </span>
                    {f.last_scan_error && (
                      <span className="text-rose-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>Error: {f.last_scan_error}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <button
                    onClick={() => setFolderToDelete(f)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20"
                    title="Remove folder from monitoring"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone: Full Rebuild */}
      <div className="p-6 bg-gradient-to-r from-rose-500/5 via-rose-500/10 to-transparent border border-rose-500/25 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>Danger Zone — Full Vector Index Rebuild</span>
            </h3>
            <p className="text-xs text-rose-300/80 mt-1 max-w-2xl leading-relaxed">
              Clears the existing vector index and queues all discovered files for fresh semantic re-extraction.
              Your original files on disk will NEVER be modified or deleted.
            </p>
          </div>

          <button
            onClick={() => setShowRebuildModal(true)}
            className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 flex-shrink-0 shadow-sm active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rebuild All Vectors</span>
          </button>
        </div>
      </div>

      {/* Folder Removal Confirmation Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-slate-100">Remove Monitored Folder?</h4>
            </div>
            
            <p className="text-xs text-slate-300 font-mono bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 break-all mb-4">
              {folderToDelete.path}
            </p>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              This removes the folder from monitoring and purges its search vectors from the index. Your files on disk remain completely safe and untouched.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteFolder}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-md shadow-rose-600/20"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rebuild Confirmation Modal */}
      {showRebuildModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-base font-semibold text-rose-300">
                Confirm Full Index Rebuild
              </h4>
            </div>

            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to rebuild the entire vector index? This operation clears existing embeddings and re-embeds all active files. Your actual disk files will never be touched.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowRebuildModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRebuild}
                disabled={isRebuilding}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-rose-600/20"
              >
                {isRebuilding && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Proceed with Rebuild</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
