import {
  SearchResponse, FolderItem, IndexStatus, HistoryResponse,
  HealthStatus, AppSettings, GenericResponse,
  SyncStats, SyncSettings, SyncItem, SyncHistoryEntry,
  DocumentListResponse, DocumentDetailResponse, DocumentPreviewResponse,
  TagItem, CollectionItem, ChatResponse, ConversationItem,
  ConversationDetailResponse, SummarizeResponse, DuplicateListResponse,
  KnowledgeGraphResponse, CompareDocumentsResponse, DocumentTimelineResponse,
  OrganizeProposalResponse, SavedSearchItem, DashboardOverviewResponse,
  AnalyticsTelemetryResponse
} from '../types';

const BASE_URL = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData.detail) {
        errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Search
  searchFiles: (params: {
    query: string;
    top_k?: number;
    file_types?: string[];
    date_from?: string;
    date_to?: string;
  }): Promise<SearchResponse> => {
    return fetchJson<SearchResponse>('/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  openFile: (params: {
    file_id?: number;
    path?: string;
    open_containing_folder?: boolean;
  }): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/search/open', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  getSuggestions: (q: string): Promise<{ query: string; suggestions: string[] }> => {
    return fetchJson<{ query: string; suggestions: string[] }>(`/search/suggest?q=${encodeURIComponent(q)}`);
  },

  // Index
  getIndexStatus: (): Promise<IndexStatus> => {
    return fetchJson<IndexStatus>('/index/status');
  },

  getFolders: (): Promise<FolderItem[]> => {
    return fetchJson<FolderItem[]>('/index/folders');
  },

  addFolder: (path: string): Promise<FolderItem> => {
    return fetchJson<FolderItem>('/index/folders', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  },

  removeFolder: (id: number): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/index/folders/${id}`, {
      method: 'DELETE',
    });
  },

  rebuildIndex: (confirm: boolean = true): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/index/rebuild', {
      method: 'POST',
      body: JSON.stringify({ confirm }),
    });
  },

  pauseWorker: (): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/index/pause', {
      method: 'POST',
    });
  },

  resumeWorker: (): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/index/resume', {
      method: 'POST',
    });
  },

  // History
  getHistory: (limit: number = 50): Promise<HistoryResponse> => {
    return fetchJson<HistoryResponse>(`/history?limit=${limit}`);
  },

  clearHistory: (): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/history', {
      method: 'DELETE',
    });
  },

  getZeroResultQueries: (limit: number = 50): Promise<HistoryResponse> => {
    return fetchJson<HistoryResponse>(`/history/failed?limit=${limit}`);
  },

  // System
  getHealth: (): Promise<HealthStatus> => {
    return fetchJson<HealthStatus>('/health');
  },

  getSettings: (): Promise<{ settings: AppSettings }> => {
    return fetchJson<{ settings: AppSettings }>('/settings');
  },

  updateSettings: (settings: AppSettings): Promise<{ settings: AppSettings }> => {
    return fetchJson<{ settings: AppSettings }>('/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
  },

  // Desktop-to-Cloud Sync Subsystem
  getSyncStatus: (): Promise<SyncStats> => {
    return fetchJson<SyncStats>('/sync/status');
  },

  getSyncSettings: (): Promise<SyncSettings> => {
    return fetchJson<SyncSettings>('/sync/settings');
  },

  updateSyncSettings: (update: {
    excluded_folders?: string[];
    excluded_extensions?: string[];
    max_file_size_bytes?: number;
    retry_limit?: number;
  }): Promise<SyncSettings> => {
    return fetchJson<SyncSettings>('/sync/settings', {
      method: 'POST',
      body: JSON.stringify(update),
    });
  },

  connectCloud: (params: { cloud_url: string; api_key?: string; workspace_id?: string }): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/sync/connect', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  disconnectCloud: (): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/sync/disconnect', {
      method: 'POST',
    });
  },

  pauseSync: (): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/sync/pause', {
      method: 'POST',
    });
  },

  resumeSync: (): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/sync/resume', {
      method: 'POST',
    });
  },

  triggerSync: (): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/sync/trigger', {
      method: 'POST',
    });
  },

  addSyncFolder: (folder_path: string): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/sync/folders', {
      method: 'POST',
      body: JSON.stringify({ folder_path }),
    });
  },

  removeSyncFolder: (folder_path: string): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/sync/folders?folder_path=${encodeURIComponent(folder_path)}`, {
      method: 'DELETE',
    });
  },

  retryFailedSync: (): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/sync/retry', {
      method: 'POST',
    });
  },

  getSyncItems: (limit: number = 100, status?: string): Promise<SyncItem[]> => {
    const q = status ? `?limit=${limit}&status=${encodeURIComponent(status)}` : `?limit=${limit}`;
    return fetchJson<SyncItem[]>(`/sync/items${q}`);
  },

  getSyncHistory: (limit: number = 50): Promise<SyncHistoryEntry[]> => {
    return fetchJson<SyncHistoryEntry[]>(`/sync/history?limit=${limit}`);
  },

  removeCloudCopy: (local_path: string): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/sync/cloud-copy?local_path=${encodeURIComponent(local_path)}`, {
      method: 'DELETE',
    });
  },

  // Document Library
  getDocuments: (params?: {
    page?: number;
    page_size?: number;
    sort_by?: string;
    sort_order?: string;
    category?: string;
    extension?: string;
    folder_id?: number;
    is_favorite?: boolean;
    status?: string;
    tag_id?: number;
    collection_id?: number;
    search?: string;
  }): Promise<DocumentListResponse> => {
    const queryParts: string[] = [];
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
        }
      });
    }
    const q = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return fetchJson<DocumentListResponse>(`/documents${q}`);
  },

  getDocumentDetails: (file_id: number): Promise<DocumentDetailResponse> => {
    return fetchJson<DocumentDetailResponse>(`/documents/${file_id}`);
  },

  getDocumentPreview: (file_id: number): Promise<DocumentPreviewResponse> => {
    return fetchJson<DocumentPreviewResponse>(`/documents/${file_id}/preview`);
  },

  toggleFavorite: (file_id: number, is_favorite: boolean): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/documents/${file_id}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ is_favorite }),
    });
  },

  classifyDocument: (file_id: number, category: string): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/documents/${file_id}/classify`, {
      method: 'POST',
      body: JSON.stringify({ category }),
    });
  },

  assignTags: (file_id: number, tag_ids: number[]): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/documents/${file_id}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_ids }),
    });
  },

  // Tags & Collections
  getTags: (): Promise<TagItem[]> => {
    return fetchJson<TagItem[]>('/tags');
  },

  createTag: (name: string, color: string = '#8b5cf6'): Promise<TagItem> => {
    return fetchJson<TagItem>('/tags', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
  },

  deleteTag: (tag_id: number): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/tags/${tag_id}`, {
      method: 'DELETE',
    });
  },

  getCollections: (): Promise<CollectionItem[]> => {
    return fetchJson<CollectionItem[]>('/collections');
  },

  createCollection: (data: {
    name: string;
    description?: string;
    is_smart?: boolean;
    rules_json?: Record<string, any>;
    color?: string;
  }): Promise<CollectionItem> => {
    return fetchJson<CollectionItem>('/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCollection: (id: number, data: {
    name?: string;
    description?: string;
    is_smart?: boolean;
    rules_json?: Record<string, any>;
    color?: string;
  }): Promise<CollectionItem> => {
    return fetchJson<CollectionItem>(`/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteCollection: (id: number): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/collections/${id}`, {
      method: 'DELETE',
    });
  },

  addFilesToCollection: (collection_id: number, file_ids: number[]): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/collections/${collection_id}/add`, {
      method: 'POST',
      body: JSON.stringify({ file_ids }),
    });
  },

  removeFilesFromCollection: (collection_id: number, file_ids: number[]): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/collections/${collection_id}/remove`, {
      method: 'POST',
      body: JSON.stringify({ file_ids }),
    });
  },

  // AI Assistant
  assistantChat: (params: {
    message: string;
    conversation_id?: string;
    scope_type?: string;
    scope_id?: string;
    document_ids?: number[];
  }): Promise<ChatResponse> => {
    return fetchJson<ChatResponse>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  summarizeDocument: (file_id: number, mode: string = 'executive'): Promise<SummarizeResponse> => {
    return fetchJson<SummarizeResponse>('/assistant/summarize', {
      method: 'POST',
      body: JSON.stringify({ file_id, mode }),
    });
  },

  getConversations: (): Promise<ConversationItem[]> => {
    return fetchJson<ConversationItem[]>('/assistant/conversations');
  },

  getConversationDetails: (conv_id: string): Promise<ConversationDetailResponse> => {
    return fetchJson<ConversationDetailResponse>(`/assistant/conversations/${encodeURIComponent(conv_id)}`);
  },

  deleteConversation: (conv_id: string): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/assistant/conversations/${encodeURIComponent(conv_id)}`, {
      method: 'DELETE',
    });
  },

  // Discovery
  getDuplicates: (): Promise<DuplicateListResponse> => {
    return fetchJson<DuplicateListResponse>('/discovery/duplicates');
  },

  deleteDuplicate: (file_id: number, confirm: boolean = true): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/discovery/duplicates/delete?file_id=${file_id}&confirm=${confirm}`, {
      method: 'POST',
    });
  },

  getKnowledgeGraph: (filter_group?: string): Promise<KnowledgeGraphResponse> => {
    const q = filter_group ? `?filter_group=${encodeURIComponent(filter_group)}` : '';
    return fetchJson<KnowledgeGraphResponse>(`/discovery/graph${q}`);
  },

  compareDocuments: (file_id_a: number, file_id_b: number): Promise<CompareDocumentsResponse> => {
    return fetchJson<CompareDocumentsResponse>('/discovery/compare', {
      method: 'POST',
      body: JSON.stringify({ file_id_a, file_id_b }),
    });
  },

  getTimeline: (limit: number = 100): Promise<DocumentTimelineResponse> => {
    return fetchJson<DocumentTimelineResponse>(`/discovery/timeline?limit=${limit}`);
  },

  proposeOrganization: (folder_id: number): Promise<OrganizeProposalResponse> => {
    return fetchJson<OrganizeProposalResponse>(`/discovery/organize/propose?folder_id=${folder_id}`);
  },

  executeOrganization: (approved_moves: Array<{ current_path: string; proposed_path: string }>): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>('/discovery/organize/execute', {
      method: 'POST',
      body: JSON.stringify({ approved_moves }),
    });
  },

  // Advanced Search & Analytics
  advancedSearch: (params: {
    query: string;
    search_mode?: string;
    top_k?: number;
    file_types?: string[];
    categories?: string[];
    folder_id?: number;
    date_from?: string;
    date_to?: string;
    min_size_bytes?: number;
    max_size_bytes?: number;
    min_score?: number;
    similar_file_id?: number;
  }): Promise<SearchResponse> => {
    return fetchJson<SearchResponse>('/search/advanced', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  getSavedSearches: (): Promise<SavedSearchItem[]> => {
    return fetchJson<SavedSearchItem[]>('/search/saved');
  },

  createSavedSearch: (name: string, query_text: string, filters_json?: Record<string, any>): Promise<SavedSearchItem> => {
    return fetchJson<SavedSearchItem>('/search/saved', {
      method: 'POST',
      body: JSON.stringify({ name, query_text, filters_json }),
    });
  },

  deleteSavedSearch: (search_id: number): Promise<GenericResponse> => {
    return fetchJson<GenericResponse>(`/search/saved/${search_id}`, {
      method: 'DELETE',
    });
  },

  getDashboardOverview: (): Promise<DashboardOverviewResponse> => {
    return fetchJson<DashboardOverviewResponse>('/analytics/dashboard');
  },

  getTelemetry: (): Promise<AnalyticsTelemetryResponse> => {
    return fetchJson<AnalyticsTelemetryResponse>('/analytics/telemetry');
  },
};
