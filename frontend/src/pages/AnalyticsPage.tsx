import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, Activity, Database, Cpu, HardDrive, RefreshCw,
  AlertTriangle, ShieldCheck, CheckCircle2, Clock, Eye, Search
} from 'lucide-react';
import { api } from '../api/client';
import { AnalyticsTelemetryResponse } from '../types';

export const AnalyticsPage: React.FC = () => {
  const { data: telemetry, isLoading, refetch } = useQuery<AnalyticsTelemetryResponse>({
    queryKey: ['systemTelemetry'],
    queryFn: () => api.getTelemetry(),
    refetchInterval: 5000,
  });

  const diag = telemetry?.diagnostics;
  const metrics = telemetry?.metrics;
  const indexStatus = telemetry?.index_status;

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
            <BarChart3 className="w-6 h-6 text-violet-400" />
            System Analytics & Deep Diagnostics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry, component health checks, search popularity, and hardware diagnostics.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition self-start sm:self-auto"
          title="Refresh telemetry"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="py-20 text-center text-slate-500">Loading system telemetry...</div>
      )}

      {!isLoading && telemetry && (
        <div className="space-y-6">
          {/* Core Health Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Database Health */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  MySQL 8 Database
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                  diag?.database?.status === 'connected'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                    : 'bg-rose-950 text-rose-300 border border-rose-800/40'
                }`}>
                  {diag?.database?.status}
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Connection Pool Size:</span>
                  <span className="font-mono text-slate-200">{diag?.database?.pool_size}</span>
                </div>
                <div className="flex justify-between">
                  <span>Multi-Statement Engine:</span>
                  <span className="text-emerald-400 font-mono">Active</span>
                </div>
              </div>
            </div>

            {/* Vector Index Health */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-violet-400" />
                  HNSW Vector Index
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-violet-950 text-violet-300 border border-violet-800/40">
                  Ready
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Active Vectors:</span>
                  <span className="font-mono text-slate-200">{diag?.vector_index?.active_vectors}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rebuild Required:</span>
                  <span className="font-mono text-slate-200">{diag?.vector_index?.needs_rebuild ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            {/* Embedding Model */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  Embedding Model
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                  {diag?.embedder?.status || 'Ready'}
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Model:</span>
                  <span className="font-mono text-slate-200 truncate ml-2">{diag?.embedder?.model}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dimensions:</span>
                  <span className="font-mono text-slate-200">{diag?.embedder?.dimensions || 384}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Popular Searches & Zero-Result Insights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Popular Searches */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                <Search className="w-4 h-4 text-violet-400" />
                Popular Search Terms
              </h2>
              <div className="space-y-2">
                {telemetry.popular_searches && telemetry.popular_searches.length > 0 ? (
                  telemetry.popular_searches.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-200 font-medium">{item.query}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950/80 text-violet-300 border border-violet-800/40">
                        {item.count} searches
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">No popular search metrics yet.</div>
                )}
              </div>
            </div>

            {/* Zero-Result Queries */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Zero-Result Discoverability Insights
              </h2>
              <div className="space-y-2">
                {telemetry.zero_result_queries?.items && telemetry.zero_result_queries.items.length > 0 ? (
                  telemetry.zero_result_queries.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <span className="text-slate-300">{item.query_text}</span>
                      <span className="text-[10px] font-mono text-amber-400">0 results</span>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No zero-result search gaps detected.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

