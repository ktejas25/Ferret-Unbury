import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, Clock, Search, FileText, Eye, RefreshCw, Trash2, ArrowRight
} from 'lucide-react';
import { api } from '../api/client';
import { HistoryResponse, DocumentListResponse } from '../types';

interface RecentActivityPageProps {
  onOpenPreview: (fileId: number) => void;
  onRepeatSearch: (query: string) => void;
}

export const RecentActivityPage: React.FC<RecentActivityPageProps> = ({
  onOpenPreview,
  onRepeatSearch,
}) => {
  const { data: historyData, refetch: refetchHistory } = useQuery<HistoryResponse>({
    queryKey: ['recentActivityHistory'],
    queryFn: () => api.getHistory(50),
  });

  const { data: recentDocsData, refetch: refetchDocs } = useQuery<DocumentListResponse>({
    queryKey: ['recentActivityDocs'],
    queryFn: () => api.getDocuments({ page_size: 30, sort_by: 'discovered_at', sort_order: 'desc' }),
  });

  const searches = historyData?.items || [];
  const recentDocs = recentDocsData?.items || [];

  const handleClearHistory = async () => {
    if (!confirm('Clear recent search history?')) return;
    await api.clearHistory();
    refetchHistory();
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-violet-400" />
            Recent Activity & Audit
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time feed of indexed documents, discovered files, and user search queries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchHistory();
              refetchDocs();
            }}
            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition"
            title="Refresh feed"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {searches.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="px-3 py-1.5 text-xs text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-800/40 rounded-lg flex items-center gap-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Search History</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently Indexed Files Feed */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-400" />
              Indexed & Discovered Files
            </h2>
            <span className="text-[11px] font-mono text-slate-500">{recentDocs.length} items</span>
          </div>

          <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto pr-1">
            {recentDocs.map((doc) => (
              <div
                key={doc.id}
                onClick={() => onOpenPreview(doc.id)}
                className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-800/40 rounded-lg cursor-pointer transition text-xs"
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="w-7 h-7 rounded-lg bg-violet-950/60 border border-violet-800/40 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div className="truncate">
                    <span className="font-medium text-slate-200 block truncate">{doc.filename}</span>
                    <span className="text-[10px] text-slate-500 font-mono truncate block">{doc.full_path}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(doc.discovered_at || doc.modified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <Eye className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                </div>
              </div>
            ))}

            {recentDocs.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">No recently discovered files.</div>
            )}
          </div>
        </div>

        {/* Search History Feed */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-400" />
              Executed Search Queries
            </h2>
            <span className="text-[11px] font-mono text-slate-500">{searches.length} queries</span>
          </div>

          <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto pr-1">
            {searches.map((s) => (
              <div
                key={s.id}
                onClick={() => onRepeatSearch(s.query_text)}
                className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-800/40 rounded-lg cursor-pointer transition text-xs group"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Search className="w-3.5 h-3.5 text-slate-500 shrink-0 group-hover:text-violet-400" />
                  <span className="font-medium text-slate-200 truncate">{s.query_text}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {s.result_count} results
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(s.searched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {searches.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-500">No search queries recorded yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

