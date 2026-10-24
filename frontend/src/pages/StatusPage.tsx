import React, { useState } from 'react';
import {
  FolderTree, Plus, Trash2, RefreshCw, Pause, Play, AlertTriangle,
  HardDrive, Cpu, FileCheck, Clock, CheckCircle2, AlertCircle, XCircle
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
      setActionMessage('Folder added and scan initiated successfully');
      setTimeout(() => setActionMessage(null), 3000);
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
      setActionMessage(`Folder ${folderToDelete.path} removed`);
      setTimeout(() => setActionMessage(null), 3000);
      setFolderToDelete(null);
      refetchFolders();
      refetchStatus();
    } catch (err: any) {
      setActionMessage(`Failed to remove folder: ${err.message}`);
      setFolderToDelete(null);
    }
  };

  const handleToggleWorkerPause = async () => {
    try {
      if (status?.is_indexing) {
        await api.pauseWorker();
        setActionMessage('Worker paused');
      } else {
        await api.resumeWorker();
        setActionMessage('Worker resumed');
      }
      setTimeout(() => setActionMessage(null), 3000);
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
      setActionMessage('Full index rebuild initiated');
      setTimeout(() => setActionMessage(null), 3000);
      refetchStatus();
      refetchFolders();
    } catch (err: any) {
      setActionMessage(`Rebuild failed: ${err.message}`);
    } finally {
      setIsRebuilding(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <RefreshCw className="w-3 h-3 animate-spin" /> Scanning
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Pause className="w-3 h-3" /> Paused
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
            Never scanned
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Action Notification */}
      {actionMessage && (
        <div className="mb-6 px-4 py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs font-medium flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-indigo-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header and Worker Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-indigo-400" />
            Index & Folder Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure local folders, inspect queue diagnostics, and monitor semantic indexing health.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              refetchStatus();
              refetchFolders();
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleToggleWorkerPause}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors ${
              status?.is_indexing
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30'
                : 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30'
            }`}
          >
            {status?.is_indexing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{status?.is_indexing ? 'Pause Worker' : 'Resume Worker'}</span>
          </button>
        </div>
      </div>

      {/* Live Indexing Progress Banner */}
      {status?.is_indexing && (
        <div className="p-4 mb-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
          <div className="flex items-center justify-between text-xs text-indigo-200 font-medium mb-2">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              Active Task: {status.current_task || 'Indexing pending documents...'}
            </span>
            <span className="font-mono text-indigo-300">
              {status.indexed_files} / {status.total_files} ({status.total_files ? ((status.indexed_files / status.total_files) * 100).toFixed(0) : 0}%)
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${status.total_files ? Math.min(100, (status.indexed_files / status.total_files) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs">Indexed Files</span>
            <FileCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-semibold text-slate-100 font-mono">
            {status?.indexed_files ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Total: {status?.total_files ?? 0} discovered</p>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs">Pending Queue</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-semibold text-slate-100 font-mono">
            {status?.pending_files ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{status?.processing_files ?? 0} currently processing</p>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs">Vector Index</span>
            <Cpu className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-semibold text-slate-100 font-mono">
            {status?.vector_count ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Deleted: {status?.deleted_vector_count ?? 0}</p>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs">Index File Size</span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-semibold text-slate-100 font-mono">
            {formatBytes(status?.index_size_bytes ?? 0)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{status?.skipped_files ?? 0} skipped, {status?.failed_files ?? 0} failed</p>
        </div>
      </div>

      {/* Add Folder Section */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl mb-8">
        <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-400" />
          Add Monitored Folder
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Provide the absolute filesystem path to any directory on your computer to recursively index and monitor.
        </p>

        <form onSubmit={handleAddFolder} className="flex flex-col sm:flex-row gap-3">
          <input
            id="add-folder-input"
            type="text"
            value={newFolderPath}
            onChange={(e) => setNewFolderPath(e.target.value)}
            placeholder="e.g. C:\Users\YourName\Documents or D:\Projects\Notes"
            className="flex-1 px-4 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            id="add-folder-submit"
            type="submit"
            disabled={isAddingFolder || !newFolderPath.trim()}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
          >
            {isAddingFolder ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Add Folder</span>
          </button>
        </form>

        {addError && (
          <p className="mt-3 text-xs text-rose-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {addError}
          </p>
        )}
      </div>

      {/* Monitored Folders List */}
      <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl mb-8">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">
          Active Monitored Folders ({folders.length})
        </h3>

        {folders.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No folders configured yet. Add your first folder above to begin indexing.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {folders.map((f) => (
              <div key={f.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <p className="text-xs font-mono font-medium text-slate-200 truncate">{f.path}</p>
                    {getStatusBadge(f.scan_status)}
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1 font-mono">
                    <span>{f.file_count} files</span>
                    <span>•</span>
                    <span>
                      {f.last_scanned_at
                        ? `Last scanned ${new Date(f.last_scanned_at).toLocaleTimeString()}`
                        : 'Initial scan pending'}
                    </span>
                    {f.last_scan_error && (
                      <span className="text-rose-400">Error: {f.last_scan_error}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setFolderToDelete(f)}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex-shrink-0"
                  title="Remove folder from monitoring"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger Zone: Full Rebuild */}
      <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Danger Zone — Index Rebuild
            </h3>
            <p className="text-xs text-rose-300/80 mt-1 max-w-2xl leading-relaxed">
              Resets the vector index and marks all discovered files for re-extraction and re-embedding.
              Your original files on disk will NEVER be deleted or modified.
            </p>
          </div>

          <button
            onClick={() => setShowRebuildModal(true)}
            className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-medium transition-colors flex-shrink-0"
          >
            Rebuild All Vectors
          </button>
        </div>
      </div>

      {/* Folder Removal Confirmation Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h4 className="text-base font-semibold text-slate-100 mb-2">Remove Monitored Folder?</h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed font-mono break-all">
              {folderToDelete.path}
            </p>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              This will remove the folder from monitoring and purge its associated metadata and search vectors. Your original files on disk remain untouched.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteFolder}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rebuild Confirmation Modal */}
      {showRebuildModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h4 className="text-base font-semibold text-rose-300 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              Confirm Full Index Rebuild
            </h4>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to rebuild the entire vector index? This operation clears existing embeddings and queues all active files for fresh re-embedding. Original disk files are never deleted.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowRebuildModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRebuild}
                disabled={isRebuilding}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium flex items-center space-x-1.5"
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
