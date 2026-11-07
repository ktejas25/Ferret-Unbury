import React, { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AppLayout } from './layouts/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { SearchPage } from './pages/SearchPage';
import { RecentActivityPage } from './pages/RecentActivityPage';
import { DocumentsLibraryPage } from './pages/DocumentsLibraryPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { DuplicatesPage } from './pages/DuplicatesPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { TimelinePage } from './pages/TimelinePage';
import { StatusPage } from './pages/StatusPage';
import { CloudSyncPage } from './pages/CloudSyncPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsModal } from './components/SettingsModal';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { DocumentDetailsDrawer } from './components/DocumentDetailsDrawer';
import { CommandPalette } from './components/CommandPalette';
import { api } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 2000,
    },
  },
});

type TabId =
  | 'overview'
  | 'search'
  | 'activity'
  | 'documents'
  | 'favorites'
  | 'collections'
  | 'duplicates'
  | 'assistant'
  | 'graph'
  | 'compare'
  | 'timeline'
  | 'status'
  | 'sync'
  | 'analytics';

const VALID_TABS: Record<string, TabId> = {
  overview: 'overview',
  search: 'search',
  activity: 'activity',
  history: 'activity',
  documents: 'documents',
  favorites: 'favorites',
  collections: 'collections',
  duplicates: 'duplicates',
  assistant: 'assistant',
  graph: 'graph',
  compare: 'compare',
  timeline: 'timeline',
  status: 'status',
  sync: 'sync',
  analytics: 'analytics',
};

const getTabFromPath = (): TabId => {
  const segment = window.location.pathname.replace(/^\//, '').toLowerCase();
  return VALID_TABS[segment] || 'overview';
};

const MainApplication: React.FC = () => {
  const [activeTab, setActiveTabState] = useState<TabId>(getTabFromPath);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<number | null>(null);
  const [detailsFileId, setDetailsFileId] = useState<number | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string | undefined>(undefined);

  const setActiveTab = useCallback((tab: string) => {
    const valid = VALID_TABS[tab] || 'overview';
    setActiveTabState(valid);
    const targetPath = valid === 'overview' ? '/' : `/${valid}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab: valid }, '', targetPath);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getTabFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Health and background status polling
  const { data: health } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: () => api.getHealth(),
    refetchInterval: 5000,
  });

  const { data: indexStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['indexStatus'],
    queryFn: () => api.getIndexStatus(),
    refetchInterval: 3000,
  });

  const { data: folders = [], refetch: refetchFolders } = useQuery({
    queryKey: ['foldersList'],
    queryFn: () => api.getFolders(),
    refetchInterval: 5000,
  });

  const { data: syncStats } = useQuery({
    queryKey: ['syncStatsGlobal'],
    queryFn: () => api.getSyncStatus(),
    refetchInterval: 10000,
  });

  const handleRepeatSearch = (queryText: string) => {
    setPendingQuery(queryText);
    setActiveTab('search');
  };

  const handleOpenPreview = (fileId: number) => {
    setPreviewFileId(fileId);
  };

  const handleOpenDetails = (fileId: number) => {
    setDetailsFileId(fileId);
  };

  return (
    <>
      <AppLayout
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        health={health}
        syncStats={syncStats}
        totalDocuments={indexStatus?.total_files ?? 0}
      >
        {activeTab === 'overview' && (
          <OverviewPage
            onNavigate={setActiveTab}
            onOpenPreview={handleOpenPreview}
            onRepeatSearch={handleRepeatSearch}
          />
        )}

        {activeTab === 'search' && (
          <SearchPage
            initialQuery={pendingQuery}
            onClearInitialQuery={() => setPendingQuery(undefined)}
            onNavigateToStatus={() => setActiveTab('status')}
            foldersCount={folders.length}
            totalIndexedFiles={indexStatus?.total_files ?? 0}
            onPreviewFile={handleOpenPreview}
            onOpenDetails={handleOpenDetails}
          />
        )}

        {activeTab === 'activity' && (
          <RecentActivityPage
            onOpenPreview={handleOpenPreview}
            onRepeatSearch={handleRepeatSearch}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentsLibraryPage
            onOpenPreview={handleOpenPreview}
            onOpenDetails={handleOpenDetails}
          />
        )}

        {activeTab === 'favorites' && (
          <FavoritesPage
            onOpenPreview={handleOpenPreview}
            onOpenDetails={handleOpenDetails}
          />
        )}

        {activeTab === 'collections' && (
          <CollectionsPage
            onOpenPreview={handleOpenPreview}
            onOpenDetails={handleOpenDetails}
          />
        )}

        {activeTab === 'duplicates' && (
          <DuplicatesPage
            onOpenPreview={handleOpenPreview}
            onOpenDetails={handleOpenDetails}
          />
        )}

        {activeTab === 'assistant' && (
          <AIAssistantPage
            onOpenPreview={handleOpenPreview}
          />
        )}

        {activeTab === 'graph' && (
          <KnowledgeGraphPage
            onOpenPreview={handleOpenPreview}
            onOpenDetails={handleOpenDetails}
          />
        )}

        {activeTab === 'compare' && (
          <ComparisonPage
            onOpenPreview={handleOpenPreview}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelinePage
            onOpenPreview={handleOpenPreview}
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

        {activeTab === 'sync' && (
          <CloudSyncPage />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsPage />
        )}
      </AppLayout>

      {/* Global Interactive Modals & Drawers */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setActiveTab}
        onOpenFilePreview={handleOpenPreview}
      />

      <DocumentPreviewModal
        fileId={previewFileId}
        onClose={() => setPreviewFileId(null)}
      />

      <DocumentDetailsDrawer
        fileId={detailsFileId}
        onClose={() => setDetailsFileId(null)}
        onOpenPreview={handleOpenPreview}
        onFavoriteToggled={() => {
          queryClient.invalidateQueries({ queryKey: ['documentsList'] });
          queryClient.invalidateQueries({ queryKey: ['favoritesList'] });
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        health={health}
      />
    </>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApplication />
    </QueryClientProvider>
  );
}
