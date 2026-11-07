import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Copy, Trash2, Eye, ExternalLink, HardDrive, AlertTriangle,
  CheckCircle2, RefreshCw, FileText, ArrowRight
} from 'lucide-react';
import { api } from '../api/client';
import { DuplicateListResponse, DuplicateGroup } from '../types';

interface DuplicatesPageProps {
  onOpenPreview: (fileId: number) => void;
  onOpenDetails: (fileId: number) => void;
}

export const DuplicatesPage: React.FC<DuplicatesPageProps> = ({
  onOpenPreview,
  onOpenDetails,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'exact' | 'similar'>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery<DuplicateListResponse>({
    queryKey: ['duplicateList'],
    queryFn: () => api.getDuplicates(),
  });

  const groups = data?.groups || [];
  const filteredGroups = filterType === 'all'
    ? groups
    : groups.filter(g => g.group_type === filterType);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleDeleteCopy = async (fileId: number, filename: string) => {
    if (!confirm(`Are you sure you want to remove duplicate copy "${filename}" from your library? The primary original file will be safely preserved.`)) {
      return;
    }
    setDeletingId(fileId);
    try {
      await api.deleteDuplicate(fileId, true);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Deletion failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Copy className="w-6 h-6 text-violet-400" />
            Duplicate Document Manager
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Detect exact hash duplicates and near-duplicate variations to reclaim disk storage safely.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition"
          title="Refresh duplicate analysis"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Summary Banner */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center shrink-0">
            <HardDrive className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Potential Storage Reclaim</span>
            <span className="text-xl font-bold text-slate-100 font-mono">
              {formatBytes(data?.total_wasted_bytes || 0)}
            </span>
            <span className="text-xs text-slate-500 block mt-0.5">
              Across {data?.total_groups || 0} duplicate group(s)
            </span>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-1 flex items-center gap-1 self-stretch sm:self-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-medium transition ${
              filterType === 'all' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Groups ({groups.length})
          </button>
          <button
            onClick={() => setFilterType('exact')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-medium transition ${
              filterType === 'exact' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Exact Hashes
          </button>
          <button
            onClick={() => setFilterType('similar')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded text-xs font-medium transition ${
              filterType === 'similar' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Semantic Similars
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          <span className="text-xs">Analyzing duplicate files and vector similarities...</span>
        </div>
      )}

      {!isLoading && filteredGroups.length === 0 && (
        <div className="py-20 text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl flex flex-col items-center justify-center gap-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-1" />
          <span className="text-sm font-medium text-slate-200">No duplicate files detected</span>
          <span className="text-xs text-slate-500">Your library is completely clean and deduplicated.</span>
        </div>
      )}

      {/* Duplicate Groups List */}
      {!isLoading && filteredGroups.length > 0 && (
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <div
              key={group.group_id}
              className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold ${
                    group.group_type === 'exact'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                      : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                  }`}>
                    {group.group_type === 'exact' ? 'Exact SHA-256 Collision' : 'Similar Content (~90%)'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {group.duplicates.length} duplicate copy found
                  </span>
                </div>

                <span className="text-xs font-mono text-slate-400">
                  Wasted: <span className="text-rose-400 font-semibold">{formatBytes(group.wasted_bytes)}</span>
                </span>
              </div>

              {/* Primary File (Original) */}
              <div className="bg-slate-950/60 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 text-xs truncate">{group.primary_file.filename}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                        Primary Original
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 truncate block">{group.primary_file.full_path}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono text-slate-400">{formatBytes(group.primary_file.size_bytes)}</span>
                  <button
                    onClick={() => onOpenPreview(group.primary_file.file_id)}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                    title="Preview file"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => api.openFile({ file_id: group.primary_file.file_id })}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                    title="Open with OS"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Duplicate Copies */}
              <div className="space-y-2 pl-4 border-l-2 border-slate-800">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Duplicate Copies to Resolve
                </span>

                {group.duplicates.map((dup) => (
                  <div
                    key={dup.file_id}
                    className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <div className="truncate">
                        <span className="font-medium text-slate-200 text-xs truncate block">{dup.filename}</span>
                        <span className="text-[11px] font-mono text-slate-500 truncate block">{dup.full_path}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-mono text-slate-400">{formatBytes(dup.size_bytes)}</span>
                      <button
                        onClick={() => onOpenPreview(dup.file_id)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                        title="Preview copy"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        disabled={deletingId === dup.file_id}
                        onClick={() => handleDeleteCopy(dup.file_id, dup.filename)}
                        className="px-2.5 py-1 text-xs font-medium text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-800/40 rounded-lg flex items-center gap-1.5 transition disabled:opacity-40"
                        title="Safely remove this duplicate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Copy</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

