import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Files, HardDrive, Calendar, AlertTriangle, Copy, Folder,
  Search, Sparkles, ArrowRight, RefreshCw, Eye, Star,
  PieChart, Layers, Clock
} from 'lucide-react';
import { api } from '../api/client';
import { DashboardOverviewResponse } from '../types';

interface OverviewPageProps {
  onNavigate: (tab: string) => void;
  onOpenPreview: (fileId: number) => void;
  onRepeatSearch: (query: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  onNavigate,
  onOpenPreview,
  onRepeatSearch,
}) => {
  const { data: metrics, isLoading, refetch } = useQuery<DashboardOverviewResponse>({
    queryKey: ['dashboardOverview'],
    queryFn: () => api.getDashboardOverview(),
    refetchInterval: 6000,
  });

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const statCards = [
    {
      title: 'Indexed Documents',
      value: metrics?.total_documents ?? 0,
      icon: Files,
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
      action: () => onNavigate('documents'),
    },
    {
      title: 'Storage Consumed',
      value: formatBytes(metrics?.total_storage_bytes ?? 0),
      icon: HardDrive,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      action: () => onNavigate('analytics'),
    },
    {
      title: 'Indexed Today',
      value: metrics?.documents_indexed_today ?? 0,
      icon: Calendar,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      action: () => onNavigate('activity'),
    },
    {
      title: 'Failed Indexing Jobs',
      value: metrics?.failed_indexing_jobs ?? 0,
      icon: AlertTriangle,
      color: (metrics?.failed_indexing_jobs ?? 0) > 0 ? 'text-rose-400' : 'text-slate-400',
      bg: (metrics?.failed_indexing_jobs ?? 0) > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800/40 border-slate-800',
      action: () => onNavigate('status'),
    },
    {
      title: 'Duplicates Found',
      value: metrics?.duplicate_count ?? 0,
      icon: Copy,
      color: (metrics?.duplicate_count ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      action: () => onNavigate('duplicates'),
    },
    {
      title: 'Monitored Folders',
      value: metrics?.active_monitored_folders ?? 0,
      icon: Folder,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/20',
      action: () => onNavigate('status'),
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Overview Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Real-time telemetry, document intelligence distribution, and indexing status.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition"
            title="Refresh statistics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('assistant')}
            className="px-3.5 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg shadow-lg shadow-violet-950/40 flex items-center gap-2 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask AI Assistant</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              onClick={card.action}
              className={`p-4 rounded-xl border ${card.bg} cursor-pointer hover:border-violet-500/40 transition group flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-slate-400 truncate">{card.title}</span>
                <Icon className={`w-4 h-4 ${card.color} shrink-0`} />
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono tracking-tight group-hover:text-violet-200 transition">
                {card.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions Launcher */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Smart Search', tab: 'search', icon: Search },
            { label: 'Browse Library', tab: 'documents', icon: Files },
            { label: 'AI Assistant', tab: 'assistant', icon: Sparkles },
            { label: 'Resolve Duplicates', tab: 'duplicates', icon: Copy },
            { label: 'Explore Graph', tab: 'graph', icon: Layers },
            { label: 'Cloud Sync', tab: 'sync', icon: RefreshCw },
          ].map((act, idx) => {
            const Icon = act.icon;
            return (
              <button
                key={idx}
                onClick={() => onNavigate(act.tab)}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 hover:text-white hover:border-violet-500/50 hover:bg-slate-800/50 transition text-xs font-medium text-left"
              >
                <Icon className="w-4 h-4 text-violet-400 shrink-0" />
                <span className="truncate">{act.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two Column Grid: Recent Documents & Recent Searches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                Recently Indexed Documents
              </h2>
              <button
                onClick={() => onNavigate('documents')}
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-medium"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-800/60">
              {metrics?.recent_documents && metrics.recent_documents.length > 0 ? (
                metrics.recent_documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => onOpenPreview(doc.id)}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition text-xs"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-7 h-7 rounded-lg bg-violet-950/60 border border-violet-800/40 flex items-center justify-center shrink-0">
                        <Files className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                      <div className="truncate">
                        <span className="font-medium text-slate-200 block truncate">{doc.filename}</span>
                        <span className="text-[10px] text-slate-500 truncate block">{doc.category || 'General Document'} • {formatBytes(doc.size_bytes)}</span>
                      </div>
                    </div>
                    <Eye className="w-4 h-4 text-slate-500 hover:text-slate-300 shrink-0 ml-2" />
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">No documents indexed yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Searches */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                <Search className="w-4 h-4 text-violet-400" />
                Recent Search Queries
              </h2>
              <button
                onClick={() => onNavigate('activity')}
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-medium"
              >
                Full history <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-800/60">
              {metrics?.recent_searches && metrics.recent_searches.length > 0 ? (
                metrics.recent_searches.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => onRepeatSearch(h.query_text)}
                    className="py-2.5 flex items-center justify-between hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition text-xs"
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Search className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="font-medium text-slate-200 truncate">{h.query_text}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 px-2 py-0.5 rounded bg-slate-800 shrink-0">
                      {h.result_count} hits
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">No search queries recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Distributions: File Types & Document Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* File Type Distribution */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-violet-400" />
            File Types Distribution
          </h2>
          <div className="space-y-3">
            {metrics?.file_type_distribution && metrics.file_type_distribution.length > 0 ? (
              metrics.file_type_distribution.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-300 uppercase">{item.label}</span>
                    <span className="text-slate-400 font-mono">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">No file types to display.</div>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Category Distribution
          </h2>
          <div className="space-y-3">
            {metrics?.category_distribution && metrics.category_distribution.length > 0 ? (
              metrics.category_distribution.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="text-slate-400 font-mono">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">No category classifications yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

