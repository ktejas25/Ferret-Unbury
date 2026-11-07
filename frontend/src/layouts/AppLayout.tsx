import React, { useState } from 'react';
import {
  Compass, Search, Activity, Files, Star, Bookmark, Copy,
  Sparkles, Network, GitCompare, Calendar, FolderGit2, Cloud,
  BarChart3, Settings, ShieldCheck, Database, Cpu, Menu, X,
  ChevronLeft, ChevronRight, Terminal
} from 'lucide-react';
import { HealthStatus, SyncStats } from '../types';

interface AppLayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  health?: HealthStatus;
  syncStats?: SyncStats;
  totalDocuments?: number;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onSelectTab,
  onOpenSettings,
  onOpenCommandPalette,
  health,
  syncStats,
  totalDocuments = 0,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navGroups = [
    {
      group: 'Discover',
      items: [
        { id: 'overview', label: 'Overview', icon: Compass },
        { id: 'search', label: 'Smart Search', icon: Search },
        { id: 'activity', label: 'Recent Activity', icon: Activity },
      ],
    },
    {
      group: 'My Library',
      items: [
        { id: 'documents', label: 'All Documents', icon: Files, badge: totalDocuments > 0 ? String(totalDocuments) : undefined },
        { id: 'favorites', label: 'Favorites', icon: Star },
        { id: 'collections', label: 'Collections & Tags', icon: Bookmark },
        { id: 'duplicates', label: 'Duplicate Manager', icon: Copy },
      ],
    },
    {
      group: 'Intelligence',
      items: [
        { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
        { id: 'graph', label: 'Knowledge Graph', icon: Network },
        { id: 'compare', label: 'Document Comparison', icon: GitCompare },
        { id: 'timeline', label: 'Document Timeline', icon: Calendar },
      ],
    },
    {
      group: 'System',
      items: [
        { id: 'status', label: 'Index & Folders', icon: FolderGit2 },
        { id: 'sync', label: 'Cloud Synchronization', icon: Cloud, badge: syncStats?.is_connected ? 'Connected' : 'Local' },
        { id: 'analytics', label: 'Analytics & Diagnostics', icon: BarChart3 },
      ],
    },
  ];

  const handleNavClick = (id: string) => {
    onSelectTab(id);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-violet-500/30 selection:text-violet-200">
      {/* Background Ambient Violet Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] bg-gradient-to-b from-violet-600/10 via-indigo-600/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Top Bar for Mobile */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-900/30">
            FA
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-100">File Archaeologist</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCommandPalette}
            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/80 rounded-lg"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-slate-400 hover:text-slate-100 bg-slate-800/80 rounded-lg"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 bg-slate-900/95 lg:bg-slate-900/60 border-r border-slate-800/80 backdrop-blur-xl flex flex-col transition-all duration-200 ${
            collapsed ? 'w-20' : 'w-64'
          } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          {/* Brand Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/80">
            <div className={`flex items-center gap-3 overflow-hidden ${collapsed ? 'justify-center w-full' : ''}`}>
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center font-bold text-white shrink-0 shadow-lg shadow-violet-950/40">
                FA
              </div>
              {!collapsed && (
                <div className="truncate">
                  <h1 className="text-sm font-semibold text-slate-100 leading-tight">File Archaeologist</h1>
                  <span className="text-[10px] text-violet-400 font-mono tracking-wider uppercase font-semibold">AI Intelligence</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Search Shortcut Trigger */}
          <div className="px-3 pt-3">
            <button
              onClick={onOpenCommandPalette}
              className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-violet-500/50 transition text-xs group ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <Search className="w-4 h-4 text-violet-400 group-hover:text-violet-300 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">Quick search...</span>
                  <span className="text-[10px] font-mono text-slate-500 px-1 py-0.5 rounded bg-slate-800 border border-slate-700">Ctrl K</span>
                </>
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
            {navGroups.map((grp) => (
              <div key={grp.group} className="space-y-1">
                {!collapsed && (
                  <h2 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                    {grp.group}
                  </h2>
                )}
                {grp.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition group relative ${
                        isActive
                          ? 'bg-violet-600/20 text-violet-200 border border-violet-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      } ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={`w-4 h-4 shrink-0 transition ${isActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {item.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom Settings & Health Bar */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
            <button
              onClick={onOpenSettings}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition ${
                collapsed ? 'justify-center' : ''
              }`}
              title={collapsed ? 'Settings & Security' : undefined}
            >
              <Settings className="w-4 h-4 shrink-0 text-slate-500" />
              {!collapsed && <span>Settings & Security</span>}
            </button>

            {!collapsed && (
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span className="capitalize">{health?.status || 'Active'}</span>
                </span>
                <span>v1.0 Pro</span>
              </div>
            )}
          </div>
        </aside>

        {/* Content View Container */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Bottom Status Bar */}
      <footer className="border-t border-slate-900 bg-slate-950/95 py-2.5 px-6 text-center text-xs text-slate-500 font-mono shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="font-semibold text-slate-300">File Archaeologist</span>
            <span>•</span>
            <span>Local-First Document Intelligence</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% Private</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>MySQL 8</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-violet-400" />
              <span>Sentence Transformers</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

