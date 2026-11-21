import React, { useState, useEffect } from 'react';
import {
  Compass, Search, Activity, Files, Star, Bookmark, Copy,
  Sparkles, Network, GitCompare, Calendar, FolderGit2, Cloud,
  BarChart3, Settings, ShieldCheck, Database, Cpu, Menu, X,
  ChevronLeft, ChevronRight, Terminal, RefreshCw
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

  // Close mobile drawer on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const navGroups = [
    {
      group: 'Discover',
      items: [
        { id: 'overview', label: 'Overview', icon: Compass, description: 'Telemetry & discovery metrics' },
        { id: 'search', label: 'Smart Search', icon: Search, description: 'Semantic & keyword hybrid search' },
        { id: 'activity', label: 'Recent Activity', icon: Activity, description: 'Search logs & event history' },
      ],
    },
    {
      group: 'My Library',
      items: [
        {
          id: 'documents',
          label: 'All Documents',
          icon: Files,
          description: 'Document library & previewer',
          badge: totalDocuments > 0 ? String(totalDocuments) : undefined,
        },
        { id: 'favorites', label: 'Favorites', icon: Star, description: 'Bookmarked priority documents' },
        { id: 'collections', label: 'Collections & Tags', icon: Bookmark, description: 'Smart collections & categories' },
        { id: 'duplicates', label: 'Duplicate Manager', icon: Copy, description: 'Exact & similarity hash diffs' },
      ],
    },
    {
      group: 'Intelligence',
      items: [
        { id: 'assistant', label: 'AI Assistant', icon: Sparkles, description: 'RAG question-answering with citations' },
        { id: 'graph', label: 'Knowledge Graph', icon: Network, description: 'Entity & topic connection graph' },
        { id: 'compare', label: 'Document Comparison', icon: GitCompare, description: 'Side-by-side textual diff analysis' },
        { id: 'timeline', label: 'Document Timeline', icon: Calendar, description: 'Chronological extracted events' },
      ],
    },
    {
      group: 'System',
      items: [
        { id: 'status', label: 'Index & Folders', icon: FolderGit2, description: 'Monitored folders & indexing worker' },
        {
          id: 'sync',
          label: 'Cloud Synchronization',
          icon: Cloud,
          description: 'Edge Worker & D1 synchronization',
          badge: syncStats?.is_connected ? 'Connected' : 'Local',
        },
        { id: 'analytics', label: 'Analytics & Diagnostics', icon: BarChart3, description: 'Hardware & deep health telemetry' },
      ],
    },
  ];

  const currentTabMeta = React.useMemo(() => {
    for (const group of navGroups) {
      const match = group.items.find((item) => item.id === currentTab);
      if (match) return { ...match, group: group.group };
    }
    return { id: currentTab, label: 'Overview', icon: Compass, description: 'Dashboard', group: 'Discover' };
  }, [currentTab, navGroups]);

  const handleNavClick = (id: string) => {
    onSelectTab(id);
    setMobileOpen(false);
  };

  const isHealthy = health?.status === 'healthy';

  return (
    <div className="h-screen h-[100dvh] w-screen w-[100dvw] overflow-hidden bg-slate-950 text-slate-100 flex flex-row font-sans selection:bg-violet-500/30 selection:text-violet-200 relative">
      {/* Background Ambient Violet Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[340px] bg-gradient-to-b from-violet-600/10 via-indigo-600/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* =========================================================================
          1. STICKY SIDEBAR (100% Viewport Height, Stationary, Independently Scrollable)
         ========================================================================= */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 h-full h-[100dvh] bg-slate-900/95 lg:bg-slate-900/75 border-r border-slate-800/80 backdrop-blur-xl flex flex-col shrink-0 transition-[width,transform] duration-300 ease-in-out shadow-2xl lg:shadow-none ${
          collapsed ? 'w-20' : 'w-68'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        aria-label="Sidebar Navigation"
      >
        {/* A. Fixed Branding Header */}
        <div className="shrink-0 h-[60px] flex items-center justify-between px-4 border-b border-slate-800/80 bg-slate-950/30">
          <div className={`flex items-center gap-3 overflow-hidden ${collapsed ? 'justify-center w-full' : ''}`}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-800 flex items-center justify-center font-bold text-white shrink-0 shadow-lg shadow-violet-950/50 ring-1 ring-violet-400/30">
              FA
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 truncate">
                <h1 className="text-sm font-semibold text-slate-100 tracking-tight leading-tight truncate">
                  File Archaeologist
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-[10px] text-violet-400 font-mono tracking-wider uppercase font-semibold">
                    Intelligence v2.0
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile Drawer Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* B. Fixed Quick Search Shortcut */}
        <div className="shrink-0 p-3 border-b border-slate-800/40 bg-slate-950/10">
          <div className="relative group">
            <button
              onClick={onOpenCommandPalette}
              className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-xl bg-slate-950/70 border border-slate-800/90 text-slate-400 hover:text-slate-100 hover:border-violet-500/50 hover:bg-slate-900 transition-all text-xs shadow-sm ${
                collapsed ? 'justify-center px-2' : ''
              }`}
              title={collapsed ? 'Quick Search (Ctrl + K)' : undefined}
            >
              <Search className="w-4 h-4 text-violet-400 group-hover:text-violet-300 shrink-0 transition-colors" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate font-normal">Quick search...</span>
                  <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/90 border border-slate-700/70 shadow-inner">
                    Ctrl K
                  </span>
                </>
              )}
            </button>

            {/* Tooltip for Quick Search in Collapsed Mode */}
            {collapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs shadow-2xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 flex items-center gap-2 font-medium">
                <span>Quick Search</span>
                <span className="text-[10px] font-mono text-slate-400 px-1 py-0.5 rounded bg-slate-800 border border-slate-700">
                  Ctrl K
                </span>
              </div>
            )}
          </div>
        </div>

        {/* C. Independently Vertically Scrollable Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-4 custom-scrollbar">
          {navGroups.map((grp, gIdx) => (
            <div key={grp.group} className="space-y-1">
              {!collapsed ? (
                <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  {grp.group}
                </div>
              ) : gIdx > 0 ? (
                <div className="h-px bg-slate-800/80 mx-2 my-2.5" />
              ) : null}

              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <div key={item.id} className="relative group">
                    <button
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative ${
                        isActive
                          ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/10 text-violet-100 border border-violet-500/30 shadow-sm shadow-violet-950/20 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                      } ${collapsed ? 'justify-center px-0' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {/* Active Indicator Accent Bar on Left */}
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-violet-400 rounded-r shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                      )}

                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-violet-400 drop-shadow-[0_0_6px_rgba(167,139,250,0.4)]'
                            : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      />

                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left truncate tracking-tight">{item.label}</span>
                          {item.badge && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium tracking-tight border ${
                                isActive
                                  ? 'bg-violet-950/80 text-violet-300 border-violet-700/60'
                                  : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>

                    {/* Descriptive Floating Tooltip in Collapsed Mode */}
                    {collapsed && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/90 text-slate-100 text-xs shadow-2xl shadow-black/80 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1 transition-all duration-150 z-50 flex items-center gap-2">
                        <span className="font-semibold">{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-violet-950 text-violet-300 border border-violet-700/60">
                            {item.badge}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400 border-l border-slate-700 pl-2">
                          {item.description}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* D. Fixed Anchored Bottom: Settings & System Status */}
        <div className="shrink-0 p-3 border-t border-slate-800/80 bg-slate-950/60 space-y-2">
          {/* Settings Button */}
          <div className="relative group">
            <button
              onClick={onOpenSettings}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-transparent hover:border-slate-700/60 transition-all ${
                collapsed ? 'justify-center px-0' : ''
              }`}
              title={collapsed ? 'Settings & Security' : undefined}
            >
              <Settings className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-slate-300 group-hover:rotate-45 transition-transform duration-300" />
              {!collapsed && <span className="flex-1 text-left truncate font-medium">Settings & Security</span>}
            </button>

            {collapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs shadow-2xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-medium">
                Settings & Security
              </div>
            )}
          </div>

          {/* System Status Footnote */}
          {!collapsed ? (
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
              <span className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isHealthy ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400'
                  }`}
                />
                <span className="capitalize text-slate-300 font-medium">
                  {health?.status || 'Online'}
                </span>
              </span>
              <span className="text-[10px] text-slate-500">v2.0 Pro</span>
            </div>
          ) : (
            <div className="relative group flex justify-center py-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isHealthy ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400'
                }`}
              />
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs shadow-2xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 font-mono">
                System: {health?.status || 'Online'}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN APPLICATION SHELL (Header + Scrollable Main Content + Footer)
         ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full h-[100dvh] overflow-hidden bg-slate-950/50">
        {/* A. Sticky Header at Top */}
        <header className="shrink-0 sticky top-0 z-20 h-[56px] bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left: Mobile Hamburger & Active Page Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-100 bg-slate-900 border border-slate-800 rounded-xl transition"
              aria-label="Toggle navigation drawer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <currentTabMeta.icon className="w-4 h-4 text-violet-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                    {currentTabMeta.group} /
                  </span>
                  <h2 className="text-sm font-bold text-slate-100 tracking-tight truncate">
                    {currentTabMeta.label}
                  </h2>
                </div>
                <p className="text-[11px] text-slate-400 truncate hidden md:block">
                  {currentTabMeta.description}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Telemetry Badges & Quick Action Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Sync Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  syncStats?.is_connected ? 'bg-emerald-400' : 'bg-indigo-400'
                }`}
              />
              <span>{syncStats?.is_connected ? 'Cloud Synced' : 'Desktop Mode'}</span>
            </div>

            {/* Quick Search Shortcut Button */}
            <button
              onClick={onOpenCommandPalette}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 hover:text-slate-200 transition"
              title="Command Palette (Ctrl + K)"
            >
              <Search className="w-3.5 h-3.5 text-violet-400" />
              <span className="font-mono text-[11px]">Ctrl K</span>
            </button>

            {/* Settings Quick Access */}
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition"
              title="System Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* B. Independently Scrollable Main Content Area */}
        <main
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-0 focus:outline-none custom-scrollbar"
          tabIndex={-1}
        >
          {children}
        </main>

        {/* C. Fixed Bottom Status Bar / Footer */}
        <footer className="shrink-0 border-t border-slate-900 bg-slate-950/95 py-2 px-4 sm:px-6 text-xs text-slate-500 font-mono z-10">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="font-semibold text-slate-200">File Archaeologist</span>
              <span>•</span>
              <span className="truncate">Local-First Document Discovery & Intelligence</span>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% Private</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>MySQL 8</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-violet-400" />
                <span>Deterministic Vectors</span>
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
