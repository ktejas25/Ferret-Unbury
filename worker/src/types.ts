export interface Env {
  DB?: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT?: string;
}

export interface SearchRequest {
  query: string;
  top_k?: number;
  file_types?: string[];
  date_from?: string;
  date_to?: string;
}

export interface SearchResultItem {
  file_id: number;
  path: string;
  filename: string;
  extension: string;
  size_bytes: number;
  modified_at: string;
  score: number;
  preview?: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  took_ms: number;
  fallback_mode: boolean;
}

export interface FolderItem {
  id: number;
  path: string;
  path_hash: string;
  is_active: boolean;
  scan_status: 'never' | 'running' | 'completed' | 'failed' | 'paused';
  file_count: number;
  created_at: string;
  last_scanned_at?: string | null;
  last_scan_error?: string | null;
}

export interface IndexStatus {
  total_files: number;
  active_files: number;
  indexed_files: number;
  pending_files: number;
  processing_files: number;
  failed_files: number;
  skipped_files: number;
  files_with_vectors: number;
  soft_deleted_files: number;
  vector_count: number;
  deleted_vector_count: number;
  index_size_bytes: number;
  is_indexing: boolean;
  current_task?: string | null;
  last_scan_error?: string | null;
  last_scanned_at?: string | null;
}

export interface HistoryItem {
  id: number;
  query_text: string;
  result_count: number;
  searched_at: string;
}

export interface HistoryResponse {
  items: HistoryItem[];
  total: number;
}

export interface HealthStatus {
  status: string;
  database: string;
  model: string;
  vector_index: string;
  worker: string;
  watcher: string;
  details?: Record<string, any>;
}

export interface AppSettings {
  [key: string]: string;
}

export interface GenericResponse {
  success: boolean;
  message: string;
  data?: any;
}

