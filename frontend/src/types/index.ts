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

// -------------------------------------------------------------
// Document Library & Tags Types
// -------------------------------------------------------------
export interface TagItem {
  id: number;
  name: string;
  color: string;
  created_at?: string;
}

export interface CollectionItem {
  id: number;
  name: string;
  description?: string | null;
  is_smart: boolean;
  rules_json?: Record<string, any> | null;
  color: string;
  item_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentItem {
  id: number;
  folder_id: number;
  filename: string;
  full_path: string;
  extension: string;
  size_bytes: number;
  modified_at: string;
  discovered_at?: string | null;
  indexed_at?: string | null;
  content_hash?: string | null;
  extraction_status: string;
  is_favorite: boolean;
  category?: string | null;
  category_confidence?: number | null;
  tags?: TagItem[];
  collections?: string[];
  content_preview?: string | null;
}

export interface DocumentListResponse {
  items: DocumentItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DocumentDetailResponse {
  document: DocumentItem;
  extractions?: Record<string, any> | null;
  entities?: Array<{ entity_name: string; entity_type: string; occurrences: number }>;
  related_documents?: Array<Record<string, any>>;
}

export interface DocumentPreviewResponse {
  file_id: number;
  filename: string;
  extension: string;
  full_path: string;
  size_bytes: number;
  content_text: string;
  pages: string[];
  summary?: string | null;
  key_points: string[];
  category?: string | null;
  important_dates: string[];
}

// -------------------------------------------------------------
// AI Assistant Types
// -------------------------------------------------------------
export interface SourceCitation {
  file_id: number;
  filename: string;
  path: string;
  page_number?: number;
  excerpt: string;
  relevance_score: number;
}

export interface ChatMessageItem {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SourceCitation[];
  created_at?: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: string;
  role: string;
  sources: SourceCitation[];
  suggested_followups: string[];
}

export interface ConversationItem {
  id: string;
  title: string;
  scope_type: string;
  scope_id?: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetailResponse {
  conversation: ConversationItem;
  messages: ChatMessageItem[];
}

export interface SummarizeResponse {
  file_id: number;
  title: string;
  summary: string;
  key_points: string[];
  action_items: string[];
  dates_mentioned: string[];
}

// -------------------------------------------------------------
// Discovery & Intelligence Types
// -------------------------------------------------------------
export interface DuplicateFileItem {
  file_id: number;
  filename: string;
  full_path: string;
  size_bytes: number;
  modified_at: string;
  similarity_score: number;
}

export interface DuplicateGroup {
  group_id: string;
  group_type: 'exact' | 'similar';
  primary_file: DuplicateFileItem;
  duplicates: DuplicateFileItem[];
  wasted_bytes: number;
}

export interface DuplicateListResponse {
  groups: DuplicateGroup[];
  total_groups: number;
  total_wasted_bytes: number;
}

export interface GraphNode {
  id: string;
  name: string;
  group: 'document' | 'person' | 'company' | 'project' | 'topic' | 'location';
  value: number;
  file_id?: number | null;
  details?: Record<string, any> | null;
}

export interface GraphLink {
  source: string;
  target: string;
  relation: string;
  strength: number;
  evidence?: string | null;
}

export interface KnowledgeGraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface DiffItem {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
}

export interface CompareDocumentsResponse {
  file_a: DocumentItem;
  file_b: DocumentItem;
  similarity_score: number;
  summary_diff: string;
  clauses_changed: string[];
  diffs: DiffItem[];
}

export interface TimelineEventItem {
  id?: number;
  file_id: number;
  filename: string;
  event_date: string;
  title: string;
  description?: string | null;
  confidence: number;
  source_page?: number;
  source_excerpt?: string | null;
}

export interface DocumentTimelineResponse {
  events: TimelineEventItem[];
  total: number;
}

export interface OrganizeProposalItem {
  file_id: number;
  filename: string;
  current_path: string;
  proposed_path: string;
  reason: string;
}

export interface OrganizeProposalResponse {
  folder_path: string;
  proposals: OrganizeProposalItem[];
  total_proposals: number;
}

export interface SavedSearchItem {
  id: number;
  name: string;
  query_text: string;
  filters_json?: Record<string, any> | null;
  created_at: string;
}

export interface DistributionItem {
  label: string;
  count: number;
  percentage: number;
}

export interface DashboardOverviewResponse {
  total_documents: number;
  total_storage_bytes: number;
  documents_indexed_today: number;
  failed_indexing_jobs: number;
  duplicate_count: number;
  active_monitored_folders: number;
  recent_documents: DocumentItem[];
  recent_searches: HistoryItem[];
  file_type_distribution: DistributionItem[];
  category_distribution: DistributionItem[];
  indexing_breakdown: Record<string, number>;
  average_indexing_latency_ms: number;
}

export interface AnalyticsTelemetryResponse {
  metrics: DashboardOverviewResponse;
  index_status: IndexStatus;
  popular_searches: Array<{ query: string; count: number }>;
  zero_result_queries: HistoryResponse;
  diagnostics: Record<string, any>;
}
