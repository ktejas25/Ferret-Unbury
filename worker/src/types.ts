export interface Env {
  DB?: D1Database;
  STORAGE_BUCKET?: R2Bucket;
  INDEXING_QUEUE?: Queue<any>;
  VECTOR_INDEX?: VectorizeIndex;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  MAX_UPLOAD_BYTES?: string;
  API_AUTH_TOKEN?: string;
}

export interface SearchRequest {
  query: string;
  top_k?: number;
  file_types?: string[];
  date_from?: string;
  date_to?: string;
  workspace_id?: string;
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
  storage_key?: string | null;
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
  scan_status: 'pending' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
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
  is_paused: boolean;
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
  storage: string;
  queue: string;
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

export interface UploadFileResponse {
  success: boolean;
  file_id: number;
  filename: string;
  storage_key: string;
  size_bytes: number;
  indexing_job_id: string;
  message: string;
}

export interface IndexingQueueMessage {
  action: 'index_file' | 'rebuild_workspace' | 'delete_file';
  workspace_id: string;
  file_id?: number;
  storage_key?: string;
  extension?: string;
  retry_count?: number;
}
