import React from 'react';
import {
  Search,
  FolderTree,
  History,
  Settings,
  Sparkles,
  Cloud,
  CloudOff,
  ShieldCheck,
  AlertTriangle,
  Compass,
  Database,
  Cpu
} from 'lucide-react';
import { HealthStatus, SyncStats } from '../types';

interface NavbarProps {
  activeTab: 'search' | 'status' | 'history';
  setActiveTab: (tab: 'search' | 'status' | 'history') => void;
  onOpenSettings: () => void;
  health?: HealthStatus;
  syncStats?: SyncStats;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSettings,
  health,
  syncStats,
}) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div
          className="flex items-center space-x-3 cursor-pointer group select-none"
          onClick={() => setActiveTab('search')}
        >
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 group-hover:scale-105 transition-all duration-200">
              <Compass className="w-5 h-5 text-white transition-transform group-hover:rotate-45 duration-300" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-indigo-200 transition-colors">
                File Archaeologist
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1 font-mono">
              <span>Local-First Semantic Discovery</span>
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800/80 shadow-inner">
          <button
            id="nav-search-tab"
            onClick={() => setActiveTab('search')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeTab === 'search'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            id="nav-status-tab"
            onClick={() => setActiveTab('status')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeTab === 'status'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Index & Folders</span>
          </button>

          <button
            id="nav-history-tab"
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
        </nav>

        {/* Status Indicators & Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Cloud Sync Status */}
          {syncStats?.is_connected ? (
            <div
              className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 shadow-sm"
              title={`Cloud sync connected to workspace: ${syncStats.workspace_id || 'default'}`}
            >
              <Cloud className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>Cloud Sync</span>
            </div>
          ) : (
            <div
              className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-900 text-slate-400 border border-slate-800"
              title="Operating 100% locally on your computer with complete privacy"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Local Offline</span>
            </div>
          )}

          {/* System Health */}
          <div
            className={`flex items-center space-x-2 px-2.5 py-1 rounded-full text-xs font-mono border transition-all ${
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
            }`}
            title={`Database: ${health?.database || 'healthy'} • Vectors: ${health?.vector_index || 'ready'} • Model: ${health?.model || 'active'}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isHealthy ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="hidden md:inline font-medium">
              {isHealthy ? 'Engine Ready' : 'Degraded'}
            </span>
          </div>

          {/* Settings Button */}
          <button
            id="nav-settings-btn"
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 border border-transparent hover:border-slate-700/60 transition-all duration-150 active:scale-95"
            title="Settings & System Diagnostics"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 transition-transform hover:rotate-45 duration-300" />
          </button>
        </div>
      </div>
    </header>
  );
};
