import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  FileCheck,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderTree,
  HardDrive,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { IndexStatus, FolderItem } from '../types';

/* ────────────────────────────────────────────────
   Configuration
   ──────────────────────────────────────────────── */

const TOAST_DURATION_MS = 3500;
const EMBEDDING_MODEL = 'all-MiniLM-L6-v2';
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';

interface BadgeConfig {
  label: string;
  Icon: LucideIcon;
  classes: string;
  spin?: boolean;
}

const SCAN_BADGES: Record<string, BadgeConfig> = {
  completed: {
    label: 'Completed',
    Icon: CheckCircle2,
    classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  },
  running: {
    label: 'Scanning',
    Icon: RefreshCw,
    classes: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25',
    spin: true,
  },
  paused: {
    label: 'Paused',
    Icon: Pause,
    classes: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
  },
  failed: {
    label: 'Failed',
    Icon: XCircle,
    classes: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  },
};

const DEFAULT_BADGE: BadgeConfig = {
  label: 'Pending scan',
  Icon: Clock,
  classes: 'bg-slate-800 text-slate-400 border-slate-700',
};

/* ────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────── */

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    SIZE_UNITS.length - 1
  );
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${SIZE_UNITS[i]}`;
};

const percentOf = (done: number, total: number): number =>
  total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

const getErrorMessage = (err: unknown, fallback = 'Something went wrong.') =>
  err instanceof Error && err.message ? err.message : fallback;

const getWorkerState = (status?: IndexStatus) => {
  if (status?.is_paused) {
    return {
      label: 'Paused',
      dot: 'bg-amber-400',
      pill: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    };
  }
  if (status?.is_indexing) {
    return {
      label: 'Indexing',
      dot: 'bg-indigo-400 animate-ping',
      pill: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    };
  }
  return {
    label: 'Idle',
    dot: 'bg-emerald-400',
    pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };
};

/* ────────────────────────────────────────────────
   Hooks
   ──────────────────────────────────────────────── */

interface ToastState {
  message: string;
  tone: 'success' | 'error';
}

/** Toast that auto-dismisses. The timer is cleared on unmount or replacement. */
const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const show = useCallback(
    (message: string, tone: ToastState['tone'] = 'success') =>
      setToast({ message, tone }),
    []
  );
  const dismiss = useCallback(() => setToast(null), []);

  return { toast, show, dismiss };
};

/* ────────────────────────────────────────────────
   Presentational components
   ──────────────────────────────────────────────── */

const ToastBar = ({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) => {
  const isError = toast.tone === 'error';
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-6 flex items-center justify-between rounded-2xl border px-4 py-3 text-xs font-medium shadow-lg animate-fade-in ${
        isError
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <Zap
          className={`h-4 w-4 ${isError ? 'text-rose-400' : 'text-indigo-400'}`}
          aria-hidden
        />
        <span>{toast.message}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className={`rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 ${FOCUS_RING}`}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
};

const ScanBadge = ({ status }: { status: string }) => {
  const { label, Icon, classes, spin } = SCAN_BADGES[status] ?? DEFAULT_BADGE;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      <Icon className={`h-3.5 w-3.5 ${spin ? 'animate-spin' : ''}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
};

const MetricCard = ({
  label,
  value,
  footnote,
  Icon,
  iconClasses,
}: {
  label: string;
  value: React.ReactNode;
  footnote: string;
  Icon: LucideIcon;
  iconClasses: string;
}) => (
  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm transition-all hover:bg-slate-900/90">
    <div className="mb-2 flex items-center justify-between text-slate-400">
      <span className="text-xs font-medium">{label}</span>
      <div className={`rounded-lg p-1.5 ${iconClasses}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
    </div>
    <div className="font-mono text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
      {value}
    </div>
    <p className="mt-1 font-mono text-[11px] text-slate-500">{footnote}</p>
  </div>
);

interface ConfirmDialogProps {
  title: string;
  titleClassName?: string;
  Icon: LucideIcon;
  children: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({
  title,
  titleClassName = 'text-slate-100',
  Icon,
  children,
  confirmLabel,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const titleId = useId();

  // Escape closes the dialog unless a request is in flight.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-rose-400">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <h2 id={titleId} className={`text-base font-semibold ${titleClassName}`}>
            {title}
          </h2>
        </div>

        <div className="mb-6 text-xs leading-relaxed text-slate-300">{children}</div>

        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={busy}
            className={`rounded-xl bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50 ${FOCUS_RING}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-rose-600/20 transition-colors hover:bg-rose-500 disabled:opacity-50 ${FOCUS_RING}`}
          >
            {busy && <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────── */

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
  const inputId = useId();

  const [newFolderPath, setNewFolderPath] = useState('');
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [isRemovingFolder, setIsRemovingFolder] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showRebuild, setShowRebuild] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);

  const [isTogglingWorker, setIsTogglingWorker] = useState(false);

  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const isWorkerPaused = Boolean(status?.is_paused);
  const worker = getWorkerState(status);
  const progress = percentOf(status?.indexed_files ?? 0, status?.total_files ?? 0);
  const totalFileCount = useMemo(
    () => folders.reduce((acc, f) => acc + (f.file_count || 0), 0),
    [folders]
  );

  const refreshAll = useCallback(() => {
    refetchStatus();
    refetchFolders();
  }, [refetchStatus, refetchFolders]);

  /* ─── Folder actions ─── */

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = newFolderPath.trim();
    if (!path) return;

    setIsAddingFolder(true);
    setAddError(null);
    try {
      await api.addFolder(path);
      setNewFolderPath('');
      showToast('Folder added. Background discovery has started.');
      refreshAll();
    } catch (err) {
      setAddError(getErrorMessage(err, 'Failed to add folder.'));
    } finally {
      setIsAddingFolder(false);
    }
  };

  const closeDeleteDialog = useCallback(() => {
    setFolderToDelete(null);
    setDeleteError(null);
  }, []);

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    setIsRemovingFolder(true);
    setDeleteError(null);
    try {
      await api.removeFolder(folderToDelete.id);
      showToast(`Stopped monitoring ${folderToDelete.path}`);
      closeDeleteDialog();
      refreshAll();
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to remove folder.'));
    } finally {
      setIsRemovingFolder(false);
    }
  };

  /* ─── Worker actions ─── */

  const toggleWorker = async () => {
    setIsTogglingWorker(true);
    try {
      if (isWorkerPaused) {
        await api.resumeWorker();
        showToast('Indexing worker resumed');
      } else {
        await api.pauseWorker();
        showToast('Indexing worker paused');
      }
      refetchStatus();
    } catch (err) {
      showToast(`Worker action failed: ${getErrorMessage(err)}`, 'error');
    } finally {
      setIsTogglingWorker(false);
    }
  };

  /* ─── Rebuild ─── */

  const closeRebuildDialog = useCallback(() => {
    setShowRebuild(false);
    setRebuildError(null);
  }, []);

  const confirmRebuild = async () => {
    setIsRebuilding(true);
    setRebuildError(null);
    try {
      await api.rebuildIndex(true);
      closeRebuildDialog();
      showToast('Full vector index rebuild started in the background');
      refreshAll();
    } catch (err) {
      setRebuildError(getErrorMessage(err, 'Rebuild failed.'));
    } finally {
      setIsRebuilding(false);
    }
  };

  /* ─────────────── Render ─────────────── */

  return (
    <div className="mx-auto max-w-6xl animate-fade-in px-4 py-8 sm:px-6">
      {toast && <ToastBar toast={toast} onDismiss={dismissToast} />}

      {/* Header & worker controls */}
      <header className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-slate-100">
            <FolderTree className="h-6 w-6 text-indigo-400" aria-hidden />
            <span>Index &amp; Folder Management</span>
          </h1>
          <p className="mt-1 max-w-xl text-xs text-slate-400 sm:text-sm">
            Manage monitored folders, check indexing progress, and control the indexing worker.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            role="status"
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-xs font-medium shadow-sm ${worker.pill}`}
          >
            <span className={`h-2 w-2 rounded-full ${worker.dot}`} aria-hidden />
            <span>Worker: {worker.label}</span>
          </div>

          <button
            type="button"
            onClick={refreshAll}
            title="Refresh statistics and folder status"
            className={`flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 shadow-sm transition-all hover:bg-slate-800 active:scale-95 ${FOCUS_RING}`}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={toggleWorker}
            disabled={isTogglingWorker}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50 ${FOCUS_RING} ${
              isWorkerPaused
                ? 'border-emerald-500/30 bg-emerald-600/20 text-emerald-300 shadow-emerald-500/10 hover:bg-emerald-600/30'
                : 'border-amber-500/30 bg-amber-600/20 text-amber-300 shadow-amber-500/10 hover:bg-amber-600/30'
            }`}
          >
            {isWorkerPaused ? (
              <Play className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Pause className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>{isWorkerPaused ? 'Resume indexing' : 'Pause indexing'}</span>
          </button>
        </div>
      </header>

      {/* Active indexing banner */}
      {status?.is_indexing && (
        <section
          aria-label="Indexing progress"
          className="mb-8 animate-fade-in rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-indigo-500/15 p-5 shadow-xl shadow-indigo-500/5"
        >
          <div className="mb-2.5 flex items-center justify-between text-xs font-medium text-indigo-200 sm:text-sm">
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" aria-hidden />
              <span>Active task: {status.current_task || 'Indexing queued files'}</span>
            </span>
            <span className="font-mono font-semibold text-indigo-300">
              {status.indexed_files} / {status.total_files} ({progress}%)
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2.5 w-full overflow-hidden rounded-full border border-slate-700/50 bg-slate-900/80"
          >
            <div
              className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-sm transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>
      )}

      {/* Metrics */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Indexed files"
          value={status?.indexed_files ?? 0}
          footnote={`${status?.total_files ?? 0} discovered on disk`}
          Icon={FileCheck}
          iconClasses="bg-emerald-500/10 text-emerald-400"
        />
        <MetricCard
          label="Pending queue"
          value={status?.pending_files ?? 0}
          footnote={`${status?.processing_files ?? 0} currently processing`}
          Icon={Clock}
          iconClasses="bg-amber-500/10 text-amber-400"
        />
        <MetricCard
          label="Vector index"
          value={status?.vector_count ?? 0}
          footnote={`${EMBEDDING_MODEL} embeddings`}
          Icon={Cpu}
          iconClasses="bg-indigo-500/10 text-indigo-400"
        />
        <MetricCard
          label="Index footprint"
          value={formatBytes(status?.index_size_bytes ?? 0)}
          footnote={`${status?.skipped_files ?? 0} skipped • ${status?.failed_files ?? 0} errors`}
          Icon={HardDrive}
          iconClasses="bg-cyan-500/10 text-cyan-400"
        />
      </div>

      {/* Add folder */}
      <section className="mb-8 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <FolderPlus className="h-4 w-4 text-indigo-400" aria-hidden />
          <span>Add monitored folder</span>
        </h2>
        <p className="mb-4 max-w-xl text-xs leading-relaxed text-slate-400">
          Enter any folder path on your computer. File Archaeologist will scan it
          recursively, watch for changes, and extract text and OCR content for search.
        </p>

        <form onSubmit={handleAddFolder} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor={inputId} className="sr-only">
              Folder path
            </label>
            <Folder
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
            <input
              id={inputId}
              type="text"
              value={newFolderPath}
              onChange={(e) => {
                setNewFolderPath(e.target.value);
                setAddError(null);
              }}
              disabled={isAddingFolder}
              placeholder="e.g. C:\Users\YourName\Documents"
              className="w-full rounded-xl border border-slate-700/80 bg-slate-950/70 py-2.5 pl-10 pr-4 font-mono text-xs text-slate-100 transition-all placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-60 sm:text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isAddingFolder || !newFolderPath.trim()}
            className={`flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/25 transition-all hover:bg-indigo-500 disabled:opacity-50 active:scale-95 sm:text-sm ${FOCUS_RING}`}
          >
            {isAddingFolder ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            <span>Add folder</span>
          </button>
        </form>

        {addError && (
          <p
            role="alert"
            className="mt-3.5 flex animate-fade-in items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-300"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-400" aria-hidden />
            <span>{addError}</span>
          </p>
        )}
      </section>

      {/* Monitored folders */}
      <section className="mb-8 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <FolderOpen className="h-4 w-4 text-indigo-400" aria-hidden />
            <span>Monitored folders ({folders.length})</span>
          </h2>
          <span className="font-mono text-xs text-slate-400">{totalFileCount} total files</span>
        </div>

        {folders.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 sm:text-sm">
            <FolderTree className="mx-auto mb-2 h-10 w-10 text-slate-600" aria-hidden />
            <p className="font-medium text-slate-300">No monitored folders yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Add a folder above to start indexing your files.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/80">
            {folders.map((f) => (
              <li key={f.id} className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <Folder className="h-4 w-4 flex-shrink-0 text-indigo-400" aria-hidden />
                    <p className="truncate font-mono text-xs font-medium text-slate-100 transition-colors group-hover:text-indigo-200 sm:text-sm">
                      {f.path}
                    </p>
                    <ScanBadge status={f.scan_status} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-slate-400">
                    <span className="font-medium text-slate-300">{f.file_count} files</span>
                    <span aria-hidden>•</span>
                    <span>
                      {f.last_scanned_at
                        ? `Last scanned ${new Date(f.last_scanned_at).toLocaleString()}`
                        : 'Initial scan pending'}
                    </span>
                    {f.last_scan_error && (
                      <span className="flex items-center gap-1 text-rose-400">
                        <AlertCircle className="h-3 w-3" aria-hidden />
                        <span>Error: {f.last_scan_error}</span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setFolderToDelete(f);
                  }}
                  aria-label={`Remove ${f.path} from monitoring`}
                  title="Remove folder from monitoring"
                  className={`flex-shrink-0 rounded-xl border border-transparent p-2 text-slate-400 transition-colors hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400 ${FOCUS_RING}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-rose-500/25 bg-gradient-to-r from-rose-500/5 via-rose-500/10 to-transparent p-6 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-rose-300">
              <AlertTriangle className="h-4 w-4 text-rose-400" aria-hidden />
              <span>Danger zone: full vector index rebuild</span>
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-rose-300/80">
              Clears the existing vector index and queues every discovered file for
              re-extraction. Your original files on disk are never modified or deleted.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowRebuild(true)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-600/20 px-4 py-2 text-xs font-semibold text-rose-300 shadow-sm transition-all hover:bg-rose-600/30 active:scale-95 ${FOCUS_RING}`}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            <span>Rebuild all vectors</span>
          </button>
        </div>
      </section>

      {/* Dialogs */}
      {folderToDelete && (
        <ConfirmDialog
          title="Remove monitored folder?"
          Icon={Trash2}
          confirmLabel="Remove folder"
          busy={isRemovingFolder}
          error={deleteError}
          onConfirm={confirmDeleteFolder}
          onCancel={closeDeleteDialog}
        >
          <p className="mb-4 break-all rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 font-mono text-slate-300">
            {folderToDelete.path}
          </p>
          <p className="text-slate-400">
            This stops monitoring the folder and removes its search vectors from the index.
            Files on disk are not touched.
          </p>
        </ConfirmDialog>
      )}

      {showRebuild && (
        <ConfirmDialog
          title="Confirm full index rebuild"
          titleClassName="text-rose-300"
          Icon={AlertTriangle}
          confirmLabel="Start rebuild"
          busy={isRebuilding}
          error={rebuildError}
          onConfirm={confirmRebuild}
          onCancel={closeRebuildDialog}
        >
          <p className="text-slate-300">
            This clears all existing embeddings and re-embeds every active file. Search
            stays available, but results may be incomplete until the rebuild finishes. Your
            files on disk are never touched.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
};