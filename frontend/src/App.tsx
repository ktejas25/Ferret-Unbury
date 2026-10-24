import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { SearchPage } from './pages/SearchPage';
import { StatusPage } from './pages/StatusPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsModal } from './components/SettingsModal';
import { api } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 2000,
    },
  },
});

const MainApplication: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'status' | 'history'>('search');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | undefined>(undefined);

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

  const handleSelectQueryFromHistory = (queryText: string) => {
    setPendingQuery(queryText);
    setActiveTab('search');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        health={health}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'search' && (
          <SearchPage
            initialQuery={pendingQuery}
            onClearInitialQuery={() => setPendingQuery(undefined)}
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
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        <p>File Archaeologist • 100% Local-First & Private • MySQL 8 & Vector ANN • Port 8420</p>
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
