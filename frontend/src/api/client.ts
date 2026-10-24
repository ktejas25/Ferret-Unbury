import {
  SearchResponse, FolderItem, IndexStatus, HistoryResponse,
  HealthStatus, AppSettings, GenericResponse
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
};
