import {
  SearchResponse, FolderItem, IndexStatus, HistoryResponse,
  HealthStatus, AppSettings, GenericResponse,
  SyncStats, SyncSettings, SyncItem, SyncHistoryEntry
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
};
