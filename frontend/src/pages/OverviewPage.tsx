import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Files, HardDrive, Calendar, AlertTriangle, Copy, Folder,
  Search, Sparkles, ArrowRight, RefreshCw, Eye, Star,
  PieChart, Layers, Clock, FileText, Code2, Image as ImageIcon,
  CheckCircle2, Network, Cloud, ExternalLink
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
  const { data: metrics, isLoading, isFetching, refetch } = useQuery<DashboardOverviewResponse>({
    queryKey: ['dashboardOverview'],
    queryFn: () => api.getDashboardOverview(),
    refetchInterval: 6000,
  });

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIconAndColor = (ext: string = '') => {
    const cleanExt = ext.toLowerCase().replace('.', '');
    if (['pdf'].includes(cleanExt)) {
      return { Icon: FileText, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };
    }
    if (['doc', 'docx', 'odt'].includes(cleanExt)) {
      return { Icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
    }
    if (['txt', 'md', 'rtf', 'log'].includes(cleanExt)) {
      return { Icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    }
    if (['py', 'ts', 'tsx', 'js', 'json', 'yaml', 'yml', 'html', 'css'].includes(cleanExt)) {
      return { Icon: Code2, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    }
    if (['jpg', 'jpeg', 'png', 'webp', 'svg', 'gif'].includes(cleanExt)) {
      return { Icon: ImageIcon, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' };
    }
    return { Icon: Files, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' };
  };

  const statCards = [
    {
      title: 'Indexed Documents',
      value: metrics?.total_documents ?? 0,
      subtitle: 'Searchable in index',
      icon: Files,
      color: 'text-violet-400',
      borderAccent: 'from-violet-500 to-indigo-500',
      bg: 'bg-violet-500/5 border-violet-500/20 hover:border-violet-500/40',
      action: () => onNavigate('documents'),
    },
    {
      title: 'Storage Consumed',
      value: formatBytes(metrics?.total_storage_bytes ?? 0),
      subtitle: 'Total indexed content',
      icon: HardDrive,
      color: 'text-indigo-400',
      borderAccent: 'from-indigo-500 to-cyan-500',
      bg: 'bg-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/40',
      action: () => onNavigate('analytics'),
    },
    {
      title: 'Indexed Today',
      value: metrics?.documents_indexed_today ?? 0,
      subtitle: 'Files added in 24h',
      icon: Calendar,
      color: 'text-emerald-400',
      borderAccent: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40',
      action: () => onNavigate('activity'),
    },
    {
      title: 'Failed Jobs',
      value: metrics?.failed_indexing_jobs ?? 0,
      subtitle: (metrics?.failed_indexing_jobs ?? 0) > 0 ? 'Action required' : 'Zero errors',
      icon: AlertTriangle,
      color: (metrics?.failed_indexing_jobs ?? 0) > 0 ? 'text-rose-400' : 'text-slate-400',
      borderAccent: (metrics?.failed_indexing_jobs ?? 0) > 0 ? 'from-rose-500 to-red-500' : 'from-slate-700 to-slate-800',
      bg: (metrics?.failed_indexing_jobs ?? 0) > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-slate-900/50 border-slate-800',
      action: () => onNavigate('status'),
    },
    {
      title: 'Duplicates Found',
      value: metrics?.duplicate_count ?? 0,
      subtitle: (metrics?.duplicate_count ?? 0) > 0 ? 'Redundant files' : 'Clean library',
      icon: Copy,
      color: (metrics?.duplicate_count ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400',
      borderAccent: (metrics?.duplicate_count ?? 0) > 0 ? 'from-amber-500 to-orange-500' : 'from-slate-700 to-slate-800',
      bg: (metrics?.duplicate_count ?? 0) > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-900/50 border-slate-800',
      action: () => onNavigate('duplicates'),
    },
    {
      title: 'Monitored Folders',
      value: metrics?.active_monitored_folders ?? 0,
      subtitle: 'Live folder watchers',
      icon: Folder,
      color: 'text-sky-400',
      borderAccent: 'from-sky-500 to-blue-500',
      bg: 'bg-sky-500/5 border-sky-500/20 hover:border-sky-500/40',
      action: () => onNavigate('status'),
    },
  ];

  const quickActions = [
    {
      title: 'Smart Search',
      description: 'Hybrid semantic & keyword discovery',
      tab: 'search',
      icon: Search,
      badge: 'Ctrl K',
    },
    {
      title: 'Browse Library',
      description: 'Filter, preview, and organize files',
      tab: 'documents',
      icon: Files,
    },
    {
      title: 'AI Assistant',
      description: 'Ask questions with traceable citations',
      tab: 'assistant',
      icon: Sparkles,
      badge: 'AI RAG',
    },
    {
      title: 'Duplicate Manager',
      description: 'Identify exact & near-duplicate files',
      tab: 'duplicates',
      icon: Copy,
    },
    {
      title: 'Knowledge Graph',
      description: 'Interactive entity & topic connections',
      tab: 'graph',
      icon: Network,
    },
    {
      title: 'Cloud Synchronization',
      description: 'Synchronize files to Cloudflare Edge',
      tab: 'sync',
      icon: Cloud,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 animate-fade-in">
      {/* 1. Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              Overview Dashboard
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Live Telemetry
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time document intelligence, storage analytics, and indexing operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => refetch()}
            className={`p-2.5 text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition shadow-sm ${
              isFetching ? 'animate-spin text-violet-400' : ''
            }`}
            title="Refresh statistics"
            aria-label="Refresh statistics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate('search')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition flex items-center gap-2 shadow-sm"
          >
            <Search className="w-3.5 h-3.5 text-violet-400" />
            <span>Smart Search</span>
          </button>

          <button
            onClick={() => onNavigate('assistant')}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-violet-950/50 flex items-center gap-2 transition transform hover:-translate-y-0.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-200" />
            <span>Ask AI Assistant</span>
          </button>
        </div>
      </div>

      {/* 2. Visual Statistics Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse p-4 space-y-3"
            >
              <div className="h-3 w-16 bg-slate-800 rounded" />
              <div className="h-7 w-20 bg-slate-800 rounded" />
              <div className="h-2.5 w-24 bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {statCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <div
                key={i}
                onClick={card.action}
                className={`p-4 rounded-2xl border ${card.bg} cursor-pointer transition-all duration-200 group flex flex-col justify-between relative overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1`}
              >
                {/* Top colored accent line */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.borderAccent} opacity-80`}
                />

                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-[11px] font-medium text-slate-400 truncate tracking-tight">
                    {card.title}
                  </span>
                  <div className="p-1.5 rounded-lg bg-slate-950/60 shrink-0 border border-slate-800/60">
                    <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xl sm:text-2xl font-bold text-slate-100 font-mono tracking-tight group-hover:text-violet-200 transition-colors">
                    {card.value}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium truncate">
                    {card.subtitle}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Refined Quick Actions Grid */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            Platform Quick Actions
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">One-click navigation</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((act, idx) => {
            const Icon = act.icon;
            return (
              <button
                key={idx}
                onClick={() => onNavigate(act.tab)}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90 text-slate-300 hover:text-white hover:border-violet-500/50 hover:bg-slate-900/90 transition-all duration-150 text-left group shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-violet-950/60 border border-violet-800/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Icon className="w-4 h-4 text-violet-400 group-hover:text-violet-300 transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-200 group-hover:text-violet-200 transition-colors truncate">
                        {act.title}
                      </span>
                      {act.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-violet-950/80 text-violet-300 border border-violet-700/60">
                          {act.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {act.description}
                    </p>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Two Column Layout: Recent Documents & Recent Searches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A. Recently Indexed Documents */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-400" />
                Recently Indexed Documents
              </h2>
              <button
                onClick={() => onNavigate('documents')}
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-semibold transition"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-800/50">
              {metrics?.recent_documents && metrics.recent_documents.length > 0 ? (
                metrics.recent_documents.map((doc) => {
                  const fileStyle = getFileIconAndColor(doc.extension);
                  const Icon = fileStyle.Icon;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => onOpenPreview(doc.id)}
                      className="py-3 px-2 flex items-center justify-between hover:bg-slate-800/40 rounded-xl cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${fileStyle.bg}`}
                        >
                          <Icon className={`w-4 h-4 ${fileStyle.color}`} />
                        </div>
                        <div className="min-w-0 truncate">
                          <span className="font-semibold text-xs text-slate-200 group-hover:text-violet-200 transition-colors block truncate">
                            {doc.filename}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono truncate block mt-0.5">
                            {doc.category || 'General Document'} • {formatBytes(doc.size_bytes)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPreview(doc.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-violet-300 hover:bg-violet-950/40 rounded-lg transition"
                          title="Preview Document"
                          aria-label="Preview Document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <Files className="w-8 h-8 text-slate-700 mx-auto" />
                  <p>No documents indexed yet.</p>
                  <button
                    onClick={() => onNavigate('status')}
                    className="text-violet-400 hover:text-violet-300 font-medium"
                  >
                    Add a monitored folder to begin &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* B. Recent Search Queries */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                <Search className="w-4 h-4 text-violet-400" />
                Recent Search Queries
              </h2>
              <button
                onClick={() => onNavigate('activity')}
                className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-semibold transition"
              >
                <span>Full history</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-800/50">
              {metrics?.recent_searches && metrics.recent_searches.length > 0 ? (
                metrics.recent_searches.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => onRepeatSearch(h.query_text)}
                    className="py-3 px-2 flex items-center justify-between hover:bg-slate-800/40 rounded-xl cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center shrink-0">
                        <Search className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="min-w-0 truncate">
                        <span className="font-medium text-xs text-slate-200 group-hover:text-violet-200 transition-colors block truncate font-mono">
                          "{h.query_text}"
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                          {h.searched_at ? h.searched_at.split('T')[0] : 'Recent query'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-400 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60">
                        {h.result_count} {h.result_count === 1 ? 'match' : 'matches'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <Search className="w-8 h-8 text-slate-700 mx-auto" />
                  <p>No search history recorded yet.</p>
                  <button
                    onClick={() => onNavigate('search')}
                    className="text-violet-400 hover:text-violet-300 font-medium"
                  >
                    Try your first search &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Distributions: File Types & Document Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* File Type Distribution */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
              <PieChart className="w-4 h-4 text-violet-400" />
              File Types Distribution
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              {metrics?.file_type_distribution?.length ?? 0} extensions
            </span>
          </div>

          <div className="space-y-3.5">
            {metrics?.file_type_distribution && metrics.file_type_distribution.length > 0 ? (
              metrics.file_type_distribution.map((item, i) => {
                const colorGradients = [
                  'from-violet-500 to-indigo-500',
                  'from-indigo-500 to-sky-500',
                  'from-emerald-500 to-teal-500',
                  'from-amber-500 to-orange-500',
                  'from-rose-500 to-pink-500',
                  'from-cyan-500 to-blue-500',
                ];
                const grad = colorGradients[i % colorGradients.length];

                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-200 uppercase px-1.5 py-0.5 rounded bg-slate-800 text-[10px]">
                          {item.label}
                        </span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {item.count} {item.count === 1 ? 'file' : 'files'} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
                      <div
                        className={`h-full bg-gradient-to-r ${grad} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(2, Math.min(100, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No indexed files to display distribution.
              </div>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Category Classification
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              Semantic groupings
            </span>
          </div>

          <div className="space-y-3.5">
            {metrics?.category_distribution && metrics.category_distribution.length > 0 ? (
              metrics.category_distribution.map((item, i) => {
                const categoryGradients = [
                  'from-indigo-500 to-violet-500',
                  'from-emerald-500 to-cyan-500',
                  'from-sky-500 to-indigo-500',
                  'from-amber-500 to-yellow-500',
                  'from-purple-500 to-pink-500',
                ];
                const grad = categoryGradients[i % categoryGradients.length];

                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium">{item.label}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
                      <div
                        className={`h-full bg-gradient-to-r ${grad} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(2, Math.min(100, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No category classifications available yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
