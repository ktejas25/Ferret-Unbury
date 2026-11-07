import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { SearchPage } from './pages/SearchPage';
import { StatusPage } from './pages/StatusPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsModal } from './components/SettingsModal';
import { api } from './api/client';
import { ShieldCheck, Database, Cpu, Lock, Sparkles } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 2000,
    },
  },
});

const MainApplication: React.FC = () => {
  const getTabFromPath = (): 'search' | 'status' | 'history' => {
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/status')) return 'status';
    if (path.startsWith('/history')) return 'history';
    return 'search';
  };

  const [activeTab, setActiveTabState] = useState<'search' | 'status' | 'history'>(getTabFromPath);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | undefined>(undefined);

  const setActiveTab = (tab: 'search' | 'status' | 'history') => {
    setActiveTabState(tab);
    const targetPath = tab === 'search' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getTabFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Poll system health
  const { data: health } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: () => api.getHealth(),
    refetchInterval: 5000,
  });

  // Poll index status
  const { data: indexStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['indexStatus'],
    queryFn: () => api.getIndexStatus(),
    refetchInterval: 3000,
  });

  // Poll monitored folders
  const { data: folders = [], refetch: refetchFolders } = useQuery({
    queryKey: ['foldersList'],
    queryFn: () => api.getFolders(),
    refetchInterval: 5000,
  });

  // Search History
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['searchHistory'],
    queryFn: () => api.getHistory(50),
  });

  // Zero-Result History (Insights)
  const { data: zeroResultData } = useQuery({
    queryKey: ['zeroResultHistory'],
    queryFn: () => api.getZeroResultQueries(50),
  });

  // Cloud Synchronization Status
  const { data: syncStats } = useQuery({
    queryKey: ['syncStats'],
    queryFn: () => api.getSyncStatus(),
    refetchInterval: 10000,
  });

  const handleSelectQueryFromHistory = (queryText: string) => {
    setPendingQuery(queryText);
    setActiveTab('search');
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
      {/* Subtle Ambient Glow Effect */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] bg-gradient-to-b from-indigo-500/10 via-violet-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        health={health}
        syncStats={syncStats}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'search' && (
          <SearchPage
            initialQuery={pendingQuery}
            onClearInitialQuery={() => setPendingQuery(undefined)}
            onNavigateToStatus={() => setActiveTab('status')}
            foldersCount={folders.length}
            totalIndexedFiles={indexStatus?.total_files ?? 0}
          />
        )}

        {activeTab === 'status' && (
          <StatusPage
            status={indexStatus}
            folders={folders}
            refetchStatus={refetchStatus}
            refetchFolders={refetchFolders}
          />
        )}

        {activeTab === 'history' && (
          <HistoryPage
            history={historyData?.items || []}
            zeroResultQueries={zeroResultData?.items || []}
            onSelectQuery={handleSelectQueryFromHistory}
            refetchHistory={refetchHistory}
          />
        )}
      </main>

      {/* App Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        health={health}
      />

      {/* Local-First Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-5 px-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-slate-400">
            <span className="font-semibold text-slate-300">File Archaeologist</span>
            <span>•</span>
            <span className="text-[11px]">v1.0 Pro</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>100% Local-First & Private</span>
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>MySQL 8 & Vector ANN</span>
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-violet-400" />
              <span>On-Device Embeddings</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApplication />
    </QueryClientProvider>
  );
}
