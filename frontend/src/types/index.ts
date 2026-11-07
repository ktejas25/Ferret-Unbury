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
  is_paused?: boolean;
  worker_status?: string;
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
  details?: {
    needs_rebuild?: boolean;
    current_task?: string | null;
    embedder?: {
      status: string;
      model: string;
      dimensions: number;
      is_fallback: boolean;
      device?: string;
    };
    [key: string]: any;
  };
}

export interface AppSettings {
  [key: string]: string;
}

export interface GenericResponse {
  success: boolean;
  message: string;
  data?: any;
}

// -------------------------------------------------------------
// Cloud & Synchronization Types
// -------------------------------------------------------------

export type SyncStatusType =
  | 'not_selected'
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'indexing'
  | 'synced'
  | 'failed'
  | 'paused'
  | 'conflict';

export interface SyncStats {
  is_connected: boolean;
  is_paused: boolean;
  total_eligible: number;
  synced_count: number;
  pending_count: number;
  uploading_count: number;
  failed_count: number;
  conflict_count: number;
  bytes_synced: number;
  cloud_url?: string | null;
  workspace_id?: string | null;
}

export interface SyncSettings {
  cloud_url: string;
  api_key: string;
  workspace_id: string;
  is_connected: boolean;
  is_paused: boolean;
  sync_folders: string[];
  excluded_folders: string[];
  excluded_extensions: string[];
  max_file_size_bytes: number;
  retry_limit: number;
}

export interface SyncItem {
  id?: number;
  local_path: string;
  filename: string;
  folder_path: string;
  content_hash: string;
  size_bytes: number;
  status: SyncStatusType;
  cloud_file_id?: string | null;
  bytes_transferred: number;
  error_message?: string | null;
  retry_count: number;
  last_sync_attempt?: string | null;
  updated_at: string;
}

export interface SyncHistoryEntry {
  id?: number;
  source_path: string;
  cloud_file_id?: string | null;
  status: string;
  bytes_transferred: number;
  error_message?: string | null;
  timestamp: string;
  action_taken: string;
}
